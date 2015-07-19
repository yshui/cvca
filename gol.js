var vshader = " \
precision mediump float; \
\
\
attribute vec2 quad; \
\
void main() { \
    gl_Position = vec4(quad, 0, 1.0); \
}";
var fshader = "\
precision mediump float; \
\
\
uniform sampler2D state; \
uniform vec2 scale; \
uniform bool invert; \
\
void main() { \
    vec4 tmp = texture2D(state, gl_FragCoord.xy / scale); \
    if (invert) \
    gl_FragColor = vec4(1.0-tmp.x, 1.0-tmp.y, 1.0-tmp.z, 0); \
    else \
    gl_FragColor = vec4(tmp.x, tmp.y, tmp.z, 0); \
}";
/**
 * Game of Life simulation and display.
 * @param {HTMLCanvasElement} canvas Render target
 * @param {number} [scale] Size of each cell in pixels (power of 2)
 * @param {number} [p] Starting probability of a cell being alive
 */
function GOL(canvas, scale, p) {
    var gl = this.gl = Igloo.getContext(canvas);
    if (gl == null) {
        alert('Could not initialize WebGL!');
        throw new Error('No WebGL');
    }
    scale = this.scale = scale || 1;
    var w = canvas.width, h = canvas.height;
    this.viewsize = [w, h];
    this.statesize = [w / scale, h / scale];
    this.timer = null;
    this.lasttick = GOL.now();
    this.fps = 0;

    gl.disable(gl.DEPTH_TEST);
    this.programs = {
        copy: new Igloo.Program(gl, vshader, fshader),
        gol: new Igloo.Program(gl, vshader, gen_shader())
    };
    this.buffers = {
        quad: new Igloo.Buffer(gl)
    };
    this.buffers.quad.update([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.textures = {
        front: this.texture(),
        back: this.texture()
    };
    this.framebuffers = {
        step: gl.createFramebuffer()
    };
    this.setRandom(p);
}

/**
 * @returns {number} The epoch in integer seconds
 */
GOL.now = function() {
    return Math.floor(Date.now() / 1000);
};

/**
 * @returns {WebGLTexture} A texture suitable for bearing Life state
 */
GOL.prototype.texture = function() {
    /* LUMINANCE textures would have been preferable (one byte per
     * cell), but, unlike RGBA, LUMINANCE is not a complete color
     * attachment for a framebuffer.
     */
    var gl = this.gl;
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                  this.statesize[0], this.statesize[1],
                  0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return tex;
};

/**
 * Set the entire simulation state at once.
 * @param state A boolean array.
 * @returns {GOL} this
 */
GOL.prototype.set = function(state) {
    var gl = this.gl;
    var rgba = new Uint8Array(this.statesize[0] * this.statesize[1] * 4);
    for (var i = 0; i < state.length; i++) {
        var ii = i * 4;
        rgba[ii + 0] = rgba[ii + 1] = rgba[ii + 2] = state[i]*255;
        rgba[ii + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.textures.front);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0,
                     this.statesize[0], this.statesize[1],
                     gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    return this;
};

/**
 * Swap the texture buffers.
 * @returns {GOL} this
 */
GOL.prototype.swap = function() {
    var tmp = this.textures.front;
    this.textures.front = this.textures.back;
    this.textures.back = tmp;
    return this;
};

/**
 * Step the Game of Life state on the GPU without rendering anything.
 * @returns {GOL} this
 */
GOL.prototype.step = function() {
    if (GOL.now() != this.lasttick) {
        $('.fps').text(this.fps + ' FPS');
        this.lasttick = GOL.now();
        this.fps = 0;
    } else {
        this.fps++;
    }
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.step);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                            gl.TEXTURE_2D, this.textures.back, 0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.front);
    gl.viewport(0, 0, this.statesize[0], this.statesize[1]);
    this.programs.gol.use()
        .attrib('quad', this.buffers.quad, 2)
        .uniform('state', 0, true)
        .uniform('scale', this.statesize)
        .draw(gl.TRIANGLE_STRIP, 4);
    this.swap();
    return this;
};

/**
 * Render the Game of Life state stored on the GPU.
 * @returns {GOL} this
 */
GOL.prototype.draw = function() {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.front);
    gl.viewport(0, 0, this.viewsize[0], this.viewsize[1]);
    var inv = $('#invert').prop("checked");
    this.programs.copy.use()
        .attrib('quad', this.buffers.quad, 2)
        .uniform('state', 0, true)
        .uniform('scale', this.viewsize)
        .uniform('invert', inv)
        .draw(gl.TRIANGLE_STRIP, 4);
    return this;
};

/**
 * @returns {Array} An RGBA snapshot of the simulation state.
 */
GOL.prototype.get = function() {
    var gl = this.gl, w = this.statesize[0], h = this.statesize[1];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.step);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                            gl.TEXTURE_2D, this.textures.front, 0);
    var rgba = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    var state = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) {
        state[i] = rgba[i * 4]/255;
    }
    return state;
};

/**
 * Run the simulation automatically on a timer.
 * @returns {GOL} this
 */
GOL.prototype.start = function() {
    this.stopped = false;
    function frame(){
        gol.step();
        gol.draw();
        var elapsed = performance.now()-this.start_time;
        var dfps = parseInt($("#fps_opt")[0].value);
        this.sleep_time += 1000/dfps-elapsed;
        if (this.sleep_time < 0)
            this.sleep_time = 0;
        while(elapsed < 1000/dfps)
            elapsed = performance.now()-this.start_time;
        if (!this.stopped) {
            this.start_time = performance.now();
            setTimeout(frame.bind(this), this.sleep_time);
        }
    }
    this.start_time = performance.now();
    this.sleep_time = 0;
    frame.call(this);
    return this;
};

/**
 * Stop animating the simulation.
 * @returns {GOL} this
 */
GOL.prototype.stop = function() {
    this.stopped = true;
    return this;
};

/**
 * Toggle the animation state.
 * @returns {GOL} this
 */
GOL.prototype.toggle = function() {
    this.stopped = !this.stopped;
    if (!this.stopped)
        this.start();
};

/**
 * Fill the entire state with random values.
 * @param {number} [p] Chance of a cell being alive (0.0 to 1.0)
 * @returns {GOL} this
 */
GOL.prototype.setRandom = function(p) {
	var gl = this.gl, size = this.statesize[0] * this.statesize[1];
	var rand = new Float32Array(size);
	if (p == null)
		p = 0.5;
	for (var i = 0; i < size; i++) {
		rand[i] = Math.random() > p ? 1.0 : 0.0;
	}
	this.set(rand);
	return this;
}
/**
 * Manages the user interface for a simulation.
 */
function Controller(gol) {
    this.gol = gol;
    var _this = this,
        $canvas = $(gol.gl.canvas);
    this.drag = null;
    $canvas.on('contextmenu', function(event) {
        event.preventDefault();
        return false;
    });
    $(document).on('keyup', function(event) {
        switch (event.which) {
        case 32: /* [space] */
            gol.toggle();
            break;
        }
    });
}

/* Initialize everything. */
var gol = null, controller = null;
$(document).ready(function() {
    var $canvas = $('#life');
    gol = new GOL($canvas[0]);
    gol.draw().start();
    controller = new Controller(gol);
});

/* Don't scroll on spacebar. */
$(window).on('keydown', function(event) {
    return !(event.keyCode === 32);
});
