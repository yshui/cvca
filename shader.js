function gen_shader(conf) {
var shader = "\
precision mediump float;\n\
uniform sampler2D state;\n\
uniform vec2 scale;\n\
void main() {\n\
vec2 pos = gl_FragCoord.xy/scale, step = vec2(1.0, 1.0)/scale;\n\
";

//Define 24 float

shader+="float ";
for(var i=0; i < 24; i++) {
	if (i != 0)
		shader += ", ";
	shader += "v"+i;
}
shader += ";\n";

var c = 0;
for(var i = -2; i <= 2; i++) {
	for(var j = -2; j <= 2; j++) {
		if (i == 0 && j == 0)
			continue;
		shader += "v"+c+" = texture2D(state, vec2(pos.x+("+i+".0*step.x), pos.y+("+j+".0*step.y))).x;\n";
		c++;
	}
}

//Sorting network

var sortnet = [[0,16],[1,17],[2,18],[3,19],[4,20],[5,21],[6,22],[7,23],
[0,8],[1,9],[2,10],[3,11],[4,12],[5,13],[6,14],[7,15],
[8,16],[9,17],[10,18],[11,19],[12,20],[13,21],[14,22],[15,23],[0,4],[1,5],[2,6],[3,7],
[8,12],[9,13],[10,14],[11,15],[16,20],[17,21],[18,22],[19,23],[0,2],[1,3],
[4,16],[5,17],[6,18],[7,19],[20,22],[21,23],[0,1],
[4,8],[5,9],[6,10],[7,11],[12,16],[13,17],[14,18],[15,19],[22,23],
[4,6],[5,7],[8,10],[9,11],[12,14],[13,15],[16,18],[17,19],
[2,16],[3,17],[6,20],[7,21],
[2,8],[3,9],[6,12],[7,13],[10,16],[11,17],[14,20],[15,21],
[2,4],[3,5],[6,8],[7,9],[10,12],[11,13],[14,16],[15,17],[18,20],[19,21],
[2,3],[4,5],[6,7],[8,9],[10,11],[12,13],[14,15],[16,17],[18,19],[20,21],
[1,16],[3,18],[5,20],[7,22],
[1,8],[3,10],[5,12],[7,14],[9,16],[11,18],[13,20],[15,22],
[1,4],[3,6],[5,8],[7,10],[9,12],[11,14],[13,16],[15,18],[17,20],[19,22],
[1,2],[3,4],[5,6],[7,8],[9,10],[11,12],[13,14],[15,16],[17,18],[19,20],[21,22]];

shader += "float tmp;\n"
for(var k in sortnet) {
	var a = sortnet[k][0], b = sortnet[k][1];
	shader += "tmp = v"+a+";\n";
	shader += "v"+a+"=min(v"+a+", v"+b+");\n";
	shader += "v"+b+"=max(tmp, v"+b+");\n";
}

if (conf == 3) {
	shader += "float res = -sqrt(v23)*0.038+v20*0.045+v10*0.84+v7*0.9-v6*0.8;";
} else {
	var coff = new Array(24);
	if (conf == 0) {
		coff[2] = -0.205;
		coff[12] = 1.275;
		coff[23] = -0.09;
	}else if (conf == 1){
		coff[9] = 0.25;
		coff[8] = 1.3;
		coff[7] = 1.1;
		coff[22] = 0.16;
		coff[20] = -0.05;
		coff[4] = -0.9;
		coff[5]=-0.9;
	} else {
		coff[0]=coff[1]=coff[2]=coff[3]=-0.4;
		coff[11]=-0.3;
		coff[12]=2;
	}

	shader += "float res = 0.0";
	for(var k = 0; k < 24; k++) {
		if (coff[k] != 0 && coff[k] != undefined)
			shader += "+("+coff[k].toFixed(5)+"*v"+k+")";
	}
	shader += ";\n";
}

shader += "gl_FragColor = vec4(res, res, res, 0);\n}"

return shader;
}
