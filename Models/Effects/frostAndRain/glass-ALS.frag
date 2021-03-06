// -*-C++-*-

varying vec2 rawPos;
varying vec3 vertPos;
varying vec3 normal;
varying vec3 refl_vec;
varying vec3 light_diffuse;
varying float splash_angle;
varying float Mie;
varying float ambient_fraction;

uniform sampler2D texture;
uniform sampler2D frost_texture;
uniform sampler2D func_texture;
uniform samplerCube cube_texture;

uniform vec4 tint;
uniform vec3 overlay_color;


uniform float rain_norm;
uniform float ground_splash_norm;
uniform float frost_level;
uniform float fog_level;
uniform float reflection_strength;
uniform float overlay_alpha;
uniform float splash_x;
uniform float splash_y;
uniform float splash_z;
uniform float osg_SimulationTime;

uniform int use_reflection;
uniform int use_mask;
uniform int use_wipers;
uniform int use_overlay;

float DotNoise2D(in vec2 coord, in float wavelength, in float fractionalMaxDotSize, in float dot_density);
float DropletNoise2D(in vec2 coord, in float wavelength, in float fractionalMaxDotSize, in float dot_density);
float Noise2D(in vec2 coord, in float wavelength);

void main()
{

vec4 texel;
vec4 frost_texel;
vec4 func_texel;

texel = texture2D(texture, gl_TexCoord[0].st);
texel *=gl_Color;

frost_texel = texture2D(frost_texture, vertPos.xy * 7.0);
func_texel = texture2D(func_texture, gl_TexCoord[0].st);
//func_texel = texture2D(func_texture, vertPos.xy * 3.0);


float noise_003m = Noise2D(vertPos.xy, 0.03);
float noise_0003m = Noise2D(vertPos.xy, 0.003);


// environment reflection

vec4 reflection = textureCube(cube_texture, refl_vec);

if (use_reflection ==1)
	{
	// to determine whether what we see reflected is currently in light, we make the somewhat drastic
	// assumption that its normal will be opposite to the glass normal
	// (which is mostly truish in a normal cockpit)
	float reflection_shade = ambient_fraction + (1.0-ambient_fraction) * max(0.0, dot (normalize(normal),  normalize(gl_LightSource[0].position.xyz)));
	texel.rgb = mix(texel.rgb, reflection.rgb, reflection_strength *  reflection_shade * (1.0-Mie));

	}

// overlay pattern

if ((use_mask == 1) && (use_overlay==1))
	{
	vec4 overlay_texel = vec4(overlay_color, overlay_alpha);
	overlay_texel.rgb *=  light_diffuse.rgb* (1.0 + 1.5*Mie);
	overlay_texel.a *=(1.0 + 0.5* Mie);
	texel = mix(texel, overlay_texel, func_texel.b * overlay_texel.a);
	}


// frost

float fth = (1.0-frost_level) * 0.4 + 0.3;
float fbl = 0.2 * frost_level;
 

float frost_factor =  (fbl + (1.0-fbl)* smoothstep(fth,fth+0.2,noise_003m)) * (4.0 + 4.0* Mie);


float background_frost =  0.5 * smoothstep(0.7,1.0,frost_level);
frost_texel.rgb = mix(frost_texel.rgb, vec3 (0.5,0.5,0.5), (1.0- smoothstep(0.0,0.02,frost_texel.a)));
frost_texel.a =max(frost_texel.a, background_frost * (1.0- smoothstep(0.0,0.02,frost_texel.a)));

frost_texel *=  vec4(light_diffuse.rgb,0.5) * (1.0 + 3.0 * Mie);

frost_factor = max(frost_factor, 0.8*background_frost);


texel.rgb =  mix(texel.rgb, frost_texel.rgb, frost_texel.a * frost_factor * smoothstep(0.0,0.1,frost_level));
texel.a = max(texel.a, frost_texel.a * frost_level);

// rain splashes

vec3 splash_vec = vec3 (splash_x, splash_y, splash_z);
float splash_speed = length(splash_vec);


float rain_factor = 0.0;

float rnorm = max(rain_norm, ground_splash_norm);

if (rnorm > 0.0)
	{
	float droplet_size = (0.5 + 0.8 * rnorm) * (1.0 - 0.1 * splash_speed);
	vec2 rainPos = vec2 (rawPos.x * splash_speed, rawPos.y / splash_speed );
	rainPos.y = rainPos.y - 0.1 * smoothstep(1.0,2.0, splash_speed) * osg_SimulationTime;
	if (splash_angle> 0.0)
	{	
	// the dynamically impacting raindrops

	float time_shape = 1.0;
	float base_rate = 6.0 + 3.0 * rnorm + 4.0 * (splash_speed - 1.0);
	float base_density = 0.6 * rnorm + 0.4  * (splash_speed -1.0);
	if ((use_mask ==1)&&(use_wipers==1)) {base_density *= (1.0 - 0.5 * func_texel.g);}

	float time_fact1 = (sin(base_rate*osg_SimulationTime));
	float time_fact2 = (sin(base_rate*osg_SimulationTime + 1.570));
	float time_fact3 = (sin(base_rate*osg_SimulationTime + 3.1415));
	float time_fact4 = (sin(base_rate*osg_SimulationTime + 4.712));

	time_fact1 = smoothstep(0.0,1.0, time_fact1);
	time_fact2 = smoothstep(0.0,1.0, time_fact2);
	time_fact3 = smoothstep(0.0,1.0, time_fact3);
	time_fact4 = smoothstep(0.0,1.0, time_fact4);

    	rain_factor += DotNoise2D(rawPos.xy, 0.02 * droplet_size ,0.5, base_density ) * time_fact1;
    	rain_factor += DotNoise2D(rainPos.xy, 0.03 * droplet_size,0.4, base_density) * time_fact2;
    	rain_factor += DotNoise2D(rawPos.xy, 0.04 * droplet_size ,0.3, base_density)* time_fact3;
    	rain_factor += DotNoise2D(rainPos.xy, 0.05 * droplet_size ,0.25, base_density)* time_fact4;
	}


	// the static pattern of small droplets created by the splashes
	
	float sweep = min(1./splash_speed,1.0);
	if ((use_mask ==1)&&(use_wipers==1)) {sweep *= (1.0 - func_texel.g);}
	rain_factor += DropletNoise2D(rainPos.xy, 0.02 * droplet_size ,0.5, 0.6* rnorm * sweep);
	rain_factor += DotNoise2D(rainPos.xy, 0.012 * droplet_size ,0.7, 0.6* rnorm * sweep);
	}

rain_factor = smoothstep(0.1,0.2, rain_factor) * (1.0 - smoothstep(0.4,1.0, rain_factor) * (0.2+0.8*noise_0003m));


vec4 rainColor = vec4 (0.2,0.2, 0.2, 0.6 - 0.3 * smoothstep(1.0,2.0, splash_speed));
rainColor.rgb *= length(light_diffuse)/1.73;



// glass tint


vec4 outerColor = mix(texel, rainColor, rain_factor);
outerColor  *= tint;


// fogging - this is inside the glass

vec4 fog_texel = vec4 (0.6,0.6,0.6, fog_level);

if (use_mask == 1) {fog_texel.a = fog_texel.a * func_texel.r;}

fog_texel *= vec4(light_diffuse.rgb,1.0); 
fog_texel.rgb *= (1.0 + 3.0 * Mie);
fog_texel.a *= min((1.0 + 0.5 * Mie), 0.85);


vec4 fragColor;

fragColor.rgb = mix(outerColor.rgb, fog_texel.rgb, fog_texel.a);
fragColor.a = max(outerColor.a, fog_texel.a);


gl_FragColor = clamp(fragColor,0.0,1.0);

//gl_FragColor = func_texel;


}
