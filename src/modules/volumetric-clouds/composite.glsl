uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform sampler2D u_cloudTexture;
uniform bool u_hasSceneDepth;

in vec2 v_textureCoordinates;

float depthWeight(float center, float sampleDepth) {
    // Reject cloud samples from the background across a foreground depth discontinuity.
    if (sampleDepth <= 0.0 || sampleDepth >= 1.0) sampleDepth = 1.0;
#ifdef LOG_DEPTH
    const float tolerance = 0.007;
#else
    float tolerance = max(0.000001, (1.0 - center) * 0.12);
#endif
    return 1.0 - smoothstep(tolerance, tolerance * 4.0, sampleDepth - center);
}

void main() {
    vec2 uv = v_textureCoordinates;
    vec4 sceneColor = texture(colorTexture, uv);
    vec2 size = vec2(textureSize(u_cloudTexture, 0));
    vec2 pixel = uv * size - 0.5;
    vec2 weight = fract(pixel);
    vec2 lo = (floor(pixel) + 0.5) / size;
    vec2 hi = lo + 1.0 / size;
    vec2 uv00 = lo;
    vec2 uv10 = vec2(hi.x, lo.y);
    vec2 uv01 = vec2(lo.x, hi.y);
    vec2 uv11 = hi;
    vec4 c00 = texture(u_cloudTexture, uv00);
    vec4 c10 = texture(u_cloudTexture, uv10);
    vec4 c01 = texture(u_cloudTexture, uv01);
    vec4 c11 = texture(u_cloudTexture, uv11);
    if (c00.a + c10.a + c01.a + c11.a == 0.0) {
        out_FragColor = sceneColor;
        return;
    }

    vec4 weights = vec4(
        (1.0 - weight.x) * (1.0 - weight.y),
        weight.x * (1.0 - weight.y),
        (1.0 - weight.x) * weight.y,
        weight.x * weight.y
    );
    if (u_hasSceneDepth) {
        float depth = texture(depthTexture, uv).r;
        if (depth > 0.0 && depth < 1.0) {
            weights *= vec4(
                depthWeight(depth, texture(depthTexture, uv00).r),
                depthWeight(depth, texture(depthTexture, uv10).r),
                depthWeight(depth, texture(depthTexture, uv01).r),
                depthWeight(depth, texture(depthTexture, uv11).r)
            );
        }
    }
    vec4 cloud = c00 * weights.x + c10 * weights.y + c01 * weights.z + c11 * weights.w;
    out_FragColor = vec4(sceneColor.rgb * (1.0 - cloud.a) + cloud.rgb, sceneColor.a + cloud.a * (1.0 - sceneColor.a));
}
