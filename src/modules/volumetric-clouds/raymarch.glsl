uniform sampler2D depthTexture;
uniform sampler2D u_noiseAtlas;
uniform sampler2D u_globeDepthTexture;
uniform vec3 u_radiiKm;
uniform vec2 u_windRotation;
uniform float u_baseKm;
uniform float u_thicknessKm;
uniform float u_coverage;
uniform float u_density;
uniform float u_shapeFrequency;
uniform float u_detailStrength;
uniform float u_brightness;
uniform float u_baseLight;
uniform float u_sunlightInfluence;
uniform float u_sunHighlight;
uniform vec4 u_dayColor;
uniform vec4 u_nightColor;
uniform int u_steps;
uniform bool u_detail;
uniform bool u_hasSceneDepth;
uniform bool u_readGlobeDepth;

in vec2 v_textureCoordinates;

vec3 rotateWithWind(vec3 p) {
    vec2 rotation = u_windRotation;
    return vec3(rotation.x * p.x + rotation.y * p.y, rotation.x * p.y - rotation.y * p.x, p.z);
}

vec2 noiseSlice(vec2 xy, float z) {
    const vec2 atlasSize = vec2(272.0, 136.0);
    vec2 tile = vec2(mod(z, 8.0), floor(z / 8.0));
    return texture(u_noiseAtlas, (tile * 34.0 + 1.5 + xy) / atlasSize).rg;
}

vec2 cloudNoise(vec3 p) {
    vec3 cell = fract(p) * 32.0;
    float slice = floor(cell.z);
    return mix(noiseSlice(cell.xy, slice), noiseSlice(cell.xy, mod(slice + 1.0, 32.0)), fract(cell.z));
}

// Distances are in km. The perpendicular offset stays well conditioned near the limb.
vec2 intersectSphere(vec3 origin, vec3 direction, float radius) {
    vec3 offset = cross(origin, direction);
    float halfSpanSquared = radius * radius - dot(offset, offset);
    if (halfSpanSquared < 0.0) return vec2(1.0, -1.0);
    float center = -dot(origin, direction);
    float halfSpan = sqrt(halfSpanSquared);
    return vec2(center - halfSpan, center + halfSpan);
}

float sceneDistance(vec2 uv, vec3 rayEC) {
    if (!u_hasSceneDepth) return 1.0e8;
    float depth = texture(depthTexture, uv).r;
    if (u_readGlobeDepth) {
        float globeDepth = czm_unpackDepth(texture(u_globeDepthTexture, uv));
        if (globeDepth > 0.0) depth = min(depth, globeDepth);
    }
    if (depth <= 0.0 || depth >= 1.0) return 1.0e8;
    vec2 windowPosition = uv * czm_viewport.zw + czm_viewport.xy;
    vec4 eyePosition = czm_windowToEyeCoordinates(windowPosition, depth);
    return (eyePosition.z / eyePosition.w) / (rayEC.z * 1000.0);
}

void marchCloud(vec3 origin, vec3 ray, vec3 scaledOrigin, vec3 scaledRay, vec2 span,
                int steps, float jitter, inout vec4 cloud) {
    float spanLength = span.y - span.x;
    if (spanLength <= 0.0) return;

    vec3 midpoint = origin + ray * mix(span.x, span.y, 0.5);
    vec3 normal = normalize(midpoint / (u_radiiKm * u_radiiKm));
    vec3 sunDirection = rotateWithWind(czm_sunDirectionWC);
    float sunHeight = dot(normal, sunDirection);
    float day = smoothstep(-0.12, 0.32, sunHeight);
    float sunFade = mix(1.0, day, u_sunlightInfluence);
    float forwardLight = pow(max(dot(ray, sunDirection), 0.0), 8.0) * day * u_sunlightInfluence * u_sunHighlight;
    vec3 tint = mix(u_nightColor.rgb, u_dayColor.rgb, sunFade) * u_brightness;
    float weather = cloudNoise(midpoint / 5100.0 + vec3(0.34, 0.73, 0.46)).r;
    float threshold = mix(0.99, 0.19, u_coverage) + (0.50 - weather) * 0.65;
    if (threshold >= 1.0) return;

    float stepSize = max(spanLength / float(steps), u_thicknessKm * 0.075);
    float detailAmplitude = 0.24 * u_detailStrength;
    float detailCutoff = -0.03 * max(1.0, u_detailStrength);
    float t = 0.0;
    float transmittance = 1.0 - cloud.a;
    for (int i = 0; i < 40; ++i) {
        if (i >= steps || t >= spanLength || transmittance < 0.015) break;
        float segment = min(stepSize, spanLength - t);
        float distanceKm = span.x + t + jitter * segment;
        vec3 position = origin + ray * distanceKm;
        float height = length(scaledOrigin + scaledRay * distanceKm) - u_radiiKm.x;
        float h = clamp((height - u_baseKm) / u_thicknessKm, 0.0, 1.0);
        vec2 shape = cloudNoise(position * u_shapeFrequency);
        float edge = threshold + 0.13 * h * h - 0.045;
        float matter = shape.r - edge;
        if (matter < -0.08 && stepSize < 1.2) {
            t += 2.0 * stepSize;
            continue;
        }
        t += segment;
        if (matter <= detailCutoff) continue;

        // Only sample the small-scale erosion where the coarse field can contain cloud.
        float detailFade = 1.0 - smoothstep(30.0, 145.0, distanceKm);
        if (u_detail && detailFade > 0.0) {
            matter += (cloudNoise(position / 11.0).g - 0.55) * detailAmplitude * detailFade;
        }
        float profile = smoothstep(0.0, 0.15, h) * (1.0 - smoothstep(0.57, 1.0, h));
        float density = smoothstep(0.0, 0.22, matter) * profile * u_density;
        if (density < 0.003) continue;

        float alpha = 1.0 - exp(-density * segment * 3.0);
        float light = clamp(mix(u_baseLight, 0.90, h) + 0.20 * shape.g + forwardLight, 0.0, 1.0);
        cloud.rgb += min(tint * light, vec3(1.0)) * (transmittance * alpha);
        transmittance *= 1.0 - alpha;
    }
    cloud.a = 1.0 - transmittance;
}

void main() {
    out_FragColor = vec4(0.0);
    if (u_coverage <= 0.0) return;

    vec2 uv = v_textureCoordinates;
    vec3 rayEC = normalize((czm_inverseProjection * vec4(uv * 2.0 - 1.0, 1.0, 1.0)).xyz);
    vec3 ray = mat3(czm_inverseView) * rayEC;
    vec3 origin = czm_viewerPositionWC * 0.001;
    vec3 axisScale = u_radiiKm.x / u_radiiKm;
    vec3 scaledOrigin = origin * axisScale;
    vec3 scaledRay = ray * axisScale;
    float scale = length(scaledRay);
    vec3 direction = scaledRay / scale;
    float outerRadius = u_radiiKm.x + u_baseKm + u_thicknessKm;
    vec2 outer = intersectSphere(scaledOrigin, direction, outerRadius) / scale;
    float start = max(0.0, outer.x);
    if (outer.y <= start) return;

    vec2 inner = intersectSphere(scaledOrigin, direction, u_radiiKm.x + u_baseKm) / scale;
    bool hitsInner = inner.y > max(start, inner.x);
    float stop = min(outer.y, sceneDistance(uv, rayEC));
    // Prevent the far-side cloud layer from showing through the planet even when depth is absent.
    if (u_readGlobeDepth && length(scaledOrigin) >= u_radiiKm.x - 0.02) {
        vec2 ground = intersectSphere(scaledOrigin, direction, u_radiiKm.x) / scale;
        if (ground.x >= 0.0 && ground.y > ground.x) stop = min(stop, ground.x);
    }
    if (stop <= start) return;

    vec2 first = vec2(start, hitsInner ? min(stop, inner.x) : stop);
    vec2 second = vec2(max(start, inner.y), stop);
    bool hasFirst = first.y > first.x;
    bool hasSecond = hitsInner && second.y > second.x;
    int firstSteps = u_steps;
    if (hasFirst && hasSecond) {
        float ratio = (first.y - first.x) / ((first.y - first.x) + (second.y - second.x));
        firstSteps = int(clamp(float(u_steps) * ratio, 4.0, float(u_steps - 4)));
    }

    // A fixed low-amplitude screen-space jitter breaks up bands without a history buffer.
    float jitter = 0.32 + 0.36 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3 advectedOrigin = rotateWithWind(origin);
    vec3 advectedRay = rotateWithWind(ray);
    vec4 cloud = vec4(0.0);
    if (hasFirst) {
        marchCloud(advectedOrigin, advectedRay, scaledOrigin, scaledRay, first, firstSteps, jitter, cloud);
    }
    if (hasSecond && cloud.a < 0.985) {
        int remainingSteps = hasFirst ? u_steps - firstSteps : u_steps;
        marchCloud(advectedOrigin, advectedRay, scaledOrigin, scaledRay, second, remainingSteps, jitter, cloud);
    }
    out_FragColor = cloud;
}
