// Shared coordinates are WGS84 degrees. Flat modes use Cesium's projected (height,x,y) axes.
const coordinates = `
uniform mat4 u_viewProjection;
uniform int u_mode;
uniform float u_radius;
uniform bool u_mercator;
uniform float u_cameraMapX;
uniform vec3 u_cameraScaled;
uniform vec3 u_inverseRadii;
uniform float u_height;
const float PI = 3.141592653589793;
vec3 earthPosition(vec2 ll) {
  vec2 r = radians(ll);
  float s = sin(r.y), c = cos(r.y);
  float n = 6378137.0 / sqrt(1.0 - 0.00669437999014 * s*s);
  return vec3((n+u_height)*c*cos(r.x), (n+u_height)*c*sin(r.x),
    (n*0.99330562000986+u_height)*s);
}
vec3 mapPosition(vec2 ll) {
  if (u_mode == 3) return earthPosition(ll);
  float x = radians(ll.x)*u_radius;
  float y = radians(ll.y)*u_radius;
  if (u_mercator) y = u_radius*log(tan(PI*.25+radians(clamp(ll.y,-85.0,85.0))*.5));
  if (u_mode == 2) x += floor((u_cameraMapX-x)/(2.0*PI*u_radius)+.5)*2.0*PI*u_radius;
  return vec3(u_mode == 2 ? 0.0 : u_height, x, y);
}
bool visible(vec2 ll) {
  vec3 p = mapPosition(ll);
  if (u_mode == 3) {
    vec3 v = p*u_inverseRadii-u_cameraScaled;
    float h = dot(u_cameraScaled,u_cameraScaled)-1.0;
    float d = -dot(v,u_cameraScaled);
    if (d>h && d*d/max(dot(v,v),.000001)>h) return false;
  }
  vec4 clip = u_viewProjection*vec4(p,1.0);
  return clip.w>0.0 && abs(clip.x)<clip.w*1.15 && abs(clip.y)<clip.w*1.15;
}
`

export const computeVertex = `
in vec4 position;
in vec2 textureCoordinates;
out vec2 v_textureCoordinates;
void main() { gl_Position=position; v_textureCoordinates=textureCoordinates; }
`

export const computeFragment = `
precision highp float;
precision highp int;
in vec2 v_textureCoordinates;
uniform sampler2D u_state;
uniform sampler2D u_wind;
uniform int u_side;
uniform int u_history;
uniform float u_dt;
uniform float u_time;
uniform float u_scale;
uniform bool u_shift;
uniform vec4 u_grid;
uniform ivec2 u_gridSize;
uniform vec4 u_bounds;
${coordinates}
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
vec2 gridValue(ivec2 p) {
  int x = (p.x % u_gridSize.x + u_gridSize.x) % u_gridSize.x;
  return texelFetch(u_wind,ivec2(x,clamp(p.y,0,u_gridSize.y-1)),0).rg;
}
vec2 wind(vec2 ll) {
  vec2 g=vec2(mod(ll.x-u_grid.x+720.0,360.0)/u_grid.z,(u_grid.y-ll.y)/u_grid.w);
  ivec2 a=ivec2(floor(g)); vec2 f=fract(g);
  return mix(mix(gridValue(a),gridValue(a+ivec2(1,0)),f.x),
    mix(gridValue(a+ivec2(0,1)),gridValue(a+ivec2(1,1)),f.x),f.y);
}
vec4 spawn(vec2 id, float generation) {
  vec2 ll=vec2(0.0); bool found=false;
  for(int i=0;i<8;i++) {
    vec2 r=vec2(hash(id+vec2(u_time,float(i))),hash(id.yx+vec2(float(i),u_time+19.0)));
    ll=vec2(mix(u_bounds.x,u_bounds.z,r.x),mix(u_bounds.y,u_bounds.w,r.y));
    ll.x=mod(ll.x+540.0,360.0)-180.0;
    if(visible(ll)) { found=true; break; }
  }
  return vec4(ll,found ? hash(id+u_time)*2.0 : 5.95,generation+1.0);
}
void main() {
  ivec2 pixel=ivec2(gl_FragCoord.xy);
  int slot=pixel.y/u_side;
  ivec2 id=ivec2(pixel.x,pixel.y % u_side);
  if(slot>0) {
    int sourceSlot=u_shift ? slot-1 : slot;
    out_FragColor=texelFetch(u_state,ivec2(id.x,id.y+sourceSlot*u_side),0); return;
  }
  vec4 p=texelFetch(u_state,id,0);
  if(p.a<.5 || p.b+u_dt>6.0 || abs(p.y)>85.0 || !visible(p.xy)) {
    out_FragColor=spawn(vec2(id),p.a); return;
  }
  // Midpoint integration follows curved flow more accurately than Euler steps.
  vec2 w=wind(p.xy);
  float cosLat=max(cos(radians(p.y)),.087);
  vec2 d=vec2(w.x/cosLat,w.y)*u_dt*u_scale/111320.0;
  vec2 mid=p.xy+d*.5;
  w=wind(mid);
  d=vec2(w.x/max(cos(radians(mid.y)),.087),w.y)*u_dt*u_scale/111320.0;
  p.xy+=d; p.x=mod(p.x+540.0,360.0)-180.0; p.b+=u_dt;
  out_FragColor=abs(p.y)>85.0 ? spawn(vec2(id),p.a) : p;
}
`

export const drawVertex = `
precision highp float;
in vec2 a_particle;
in vec2 a_trail;
uniform sampler2D u_state;
uniform sampler2D u_wind;
uniform float u_historySize;
uniform vec2 u_viewport;
uniform float u_lineWidth;
uniform vec4 u_grid;
uniform vec2 u_gridSizeFloat;
out float v_alpha;
out float v_edge;
out float v_valid;
out float v_speed;
${coordinates}
vec4 state(float slot) { return texture(u_state,vec2(a_particle.x,(slot+a_particle.y)/u_historySize)); }
void main() {
  float slot=a_trail.x;
  vec4 p=state(slot), head=state(0.0);
  vec4 neighbor=state(slot<.5 ? 1.0 : slot-1.0);
  vec4 clip=u_viewProjection*vec4(mapPosition(p.xy),1.0);
  vec4 other=u_viewProjection*vec4(mapPosition(neighbor.xy),1.0);
  vec2 ndc=clip.xy/max(clip.w,.00001), nextNdc=other.xy/max(other.w,.00001);
  vec2 direction=(ndc-nextNdc)*u_viewport;
  float magnitude=length(direction);
  vec2 normal=magnitude>.0001 ? vec2(-direction.y,direction.x)/magnitude : vec2(0.0,1.0);
  clip.xy+=normal*a_trail.y*u_lineWidth/u_viewport*clip.w;
  bool seam=u_mode!=3 && abs(ndc.x-nextNdc.x)>1.0;
  v_valid=p.a>.5 && abs(p.a-head.a)<.001 && abs(neighbor.a-head.a)<.001 &&
    clip.w>0.0 && other.w>0.0 && !seam ? 1.0 : 0.0;
  v_alpha=pow(max(0.0,1.0-slot/(u_historySize-1.0)),1.5);
  v_edge=a_trail.y;
  vec2 cell=vec2(mod(p.x-u_grid.x+720.0,360.0)/u_grid.z,(u_grid.y-p.y)/u_grid.w);
  vec2 uv=(cell+.5)/u_gridSizeFloat;
  v_speed=length(texture(u_wind,uv).rg);
  gl_Position=clip;
}
`

export const drawFragment = `
precision highp float;
in float v_alpha;
in float v_edge;
in float v_valid;
in float v_speed;
vec3 color(float s) {
  vec3 colors[6]=vec3[6](vec3(.545,.851,1.),vec3(.361,.898,.878),vec3(.569,.929,.608),
    vec3(.961,.922,.514),vec3(1.,.718,.404),vec3(1.,.467,.518));
  float value=clamp(s/6.0,0.0,5.0); int a=int(floor(value));
  return mix(colors[a],colors[min(a+1,5)],fract(value));
}
void main() {
  if(v_valid<.999) discard;
  float alpha=v_alpha*(1.0-smoothstep(.55,1.0,abs(v_edge)))*.9;
  if(alpha<.01) discard;
  out_FragColor=vec4(color(v_speed),alpha);
}
`
