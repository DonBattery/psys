"use strict";

// — tell Emscripten which canvas to use —
var Module = { canvas: document.getElementById('canvas') };

// PICO-8 API //

// the 128 GPIO pin, each represented with a byte, both available for the web page and the running PICO-8 instance
window.pico8_gpio = new Uint8Array(128);

// FIFO pipe to send function calls to the running PICO-8 instance
const p8Queue = [];

// Function ID enums
const DEBUG_FN = 0;
const GEN_FN = 1;
const PAL_FN = 2;
const FORCE_FN = 3;
const EMITTER_FN = 4;

// the status LED under the PICO-8 canvas, displaying the value of the first pin (0: not ready/red, 1: ready/green, 2: processing/blue)
const led = document.getElementById('led');

// standard palette
const p8Colors = [
    "#000000", "#1d2b53", "#7e2553", "#008751",
    "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
    "#ff004d", "#ffa300", "#ffec27", "#00e436",
    "#29adff", "#83769c", "#ff77a8", "#ffccaa"
];

// extended palette
const p8ExtColors = [
    "#291814", "#111d35", "#422136", "#125359",
    "#742f29", "#49333b", "#a28879", "#f3ef7d",
    "#be1250", "#ff6c24", "#a8e72e", "#00b543",
    "#065ab5", "#754665", "#ff6e59", "#ff9d81"
];

// enqueue a call to PICO-8 (function ID, optional single param or list of params)
function p8(fnID, inputs = []) {
    // convert bool to number
    if (typeof inputs === 'boolean') {
        inputs = inputs ? 1 : 0;
    }

    // convert single values into list
    if (!Array.isArray(inputs)) {
        inputs = [inputs];
    }

    p8Queue.push({
        fnID,
        numInputs: inputs.length,
        inputs
    });
}

// process the PICO-8 call queue on every frame
function processP8Queue() {
    const gpio = window.pico8_gpio;

    // if PICO-8 is ready to read, and we have something in the queue
    if (gpio[0] === 1 && p8Queue.length) {
        // get the first call from the queue
        const { fnID, numInputs, inputs } = p8Queue.shift();
        // set the first pin to "processing"
        gpio[0] = 2;
        // set the second pin to the function ID
        gpio[1] = fnID & 0xFF;
        // set the third pin to the number of inputs
        gpio[2] = numInputs & 0xFF;
        // write the arguments of the call from the forth pin
        inputs.forEach((v, i) => gpio[3 + i] = v & 0xFF);
    }

    // update the status LED (0: not ready/red, 1: ready/green, 2: processing/blue)
    $(led).attr('class', ['red_light', 'green_light', 'blue_light'][gpio[0]]);

    // loop to the next frame
    requestAnimationFrame(processP8Queue);
}

// encode particle options to a 16 bit number
function encodeParticle(opts) {
    const k = opts.kind & 0x7;
    const l = (opts.life & 0x7) << 3;
    const s = (opts.size & 0xF) << 6;
    const c = (opts.color & 0xF) << 10;
    const p = (opts.physics & 0x3) << 14;
    return k | l | s | c | p;
}

// encode emitter options to a 16 bit number
function encodeEmitter(opts) {
    const b = opts.burst & 0x7;
    const sp = (opts.spread & 0x3) << 3;
    const co = (opts.cone & 0x7) << 5;
    const d = (opts.delay & 0x3) << 8;
    const u = (opts.update & 0xF) << 10;
    const phy = (opts.override & 0x3) << 14;
    return b | sp | co | d | u | phy;
}

// split a 16-bit word into [lo, hi] bytes
function bytesFrom(word) {
    return [word & 0xFF, (word >> 8) & 0xFF];
}

function setupResetButton() {
    const reset = $('#reset');

    reset.on('mousedown touchstart', function (e) {
        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        // clear any existing timer
        if (EditorState.resetTimer !== null) {
            clearTimeout(EditorState.resetTimer);
            EditorState.resetTimer = null;
        }

        reset.addClass('pressing');

        // set timer for 3 seconds
        EditorState.resetTimer = setTimeout(function () {
            reset.removeClass('pressing').addClass('blinking');

            // after blinking (3 blinks * 0.3s = 0.9s), reset the cart
            setTimeout(function () {
                // clear the p8 call stack
                p8Queue.length = 0;
                // clear the gpio pins
                window.pico8_gpio = new Uint8Array(128);
                // reset the PICO-8 cart
                Module.pico8Reset();
                reset.removeClass('blinking');
            }, 900);

            EditorState.resetTimer = null;
        }, 3000);
    });

    reset.on('mouseup touchend mouseleave', function (e) {
        if (e.type === 'touchend') {
            e.preventDefault();
        }

        if (EditorState.resetTimer !== null) {
            clearTimeout(EditorState.resetTimer);
            EditorState.resetTimer = null;
            reset.removeClass('pressing').text(originalText);
        }
    });

    // Prevent context menu on long touch
    reset.on('contextmenu', function (e) {
        e.preventDefault();
        return false;
    });
}

// toggle the map sides (open or closed)
function toggleSideButton(button, stateKey) {
    const $button = $(button);
    const isOpen = EditorState.worldProps[stateKey];

    // Remove one class and add the other
    $button.removeClass(isOpen ? 'green' : 'red')
        .addClass(isOpen ? 'red' : 'green');

    EditorState.worldProps[stateKey] = !isOpen;
}

// tell PICO-8 to generate a new map
function generateNewMap() {
    p8(GEN_FN, [
        +$('#density_slider').val(),
        EditorState.worldProps.leftOpen ? 0 : 1,
        EditorState.worldProps.rightOpen ? 0 : 1,
        EditorState.worldProps.topOpen ? 0 : 1,
        EditorState.worldProps.bottomOpen ? 0 : 1,
        +$('#base-color').val(),
        +$('#highlight-color').val(),
        +$('#background-color').val(),
        +$('#damage-color').val(),
        +$('#strength_slider').val()
    ]);
}

// send updated palette & strength to PICO-8
function sendPaletteUpdate() {
    p8(PAL_FN, [
        +$('#base-color').val(),
        +$('#highlight-color').val(),
        +$('#background-color').val(),
        +$('#damage-color').val(),
        +$('#strength_slider').val()
    ]);
}

function sendForceUpdate() {
    // send force value to PICO-8
    let val = +$('#force_slider').val();

    p8(FORCE_FN, val);

    val = (4 / 256) * val;

    let c = 'red';

    if (val <= 1) {
        c = 'gray';
    } else if (val <= 2) {
        c = 'yellow';
    } else if (val <= 3) {
        c = 'orange';
    }

    // update the force label's color accordingly
    $('#force_label').removeClass('gray orange yellow red').addClass(c);
}

// populate a selected color picker with a palette & set default
// init & populate color pickers
function initColorPicker(selectId, paletteArr) {
    const $sel = $(selectId);
    paletteArr.forEach((col, i) => {
        const txt = i === 7 ? 'var(--c0)' : 'var(--c7)';
        $sel.append(`
            <option value="${i}" data-color="${col}" 
                    style="background:${col};color:${txt}">${i}</option>
        `);
    });
    $sel.on('change', function () {
        const idx = +this.value;
        const col = $(this).find(':selected').data('color');
        const txt = idx === 7 ? 'var(--c0)' : 'var(--c7)';
        $sel.css({ 'background-color': col, 'color': txt });
        // update palette index
        EditorState.palettes[EditorState.currentPalette][this.id.replace('-color', '')] = idx;
        sendPaletteUpdate();
    });
}

// populateColorPicker: loop pickers → set .val() & trigger preview
function populateColorPicker(palIdx) {
    EditorState.pickers.forEach(({ key, arr }) => {
        $(`#${key}-color`).val(EditorState.palettes[palIdx][key]).trigger('change');
    });
}

function sendParticleAndEmitterToPico8() {
    // split into [lo, hi] bytes
    const [pLo, pHi] = bytesFrom(encodeParticle(EditorState.particle));
    const [eLo, eHi] = bytesFrom(encodeEmitter(EditorState.emitter));

    p8(EMITTER_FN, [pLo, pHi, eLo, eHi]);
}

function populateOptSelectors() {

    // auto wiring of the <select> dropdowns:
    $('.particle-opts').each(function () {
        // e.g. id = "select_particle_kind"  or  "select_emitter_update"
        const [, group, prop] = this.id.split('_');
        const defs = EditorState[group + 'Props'];
        const def = defs && defs[prop];

        const $sel = $(this);

        def.values.forEach((_, i) => $sel.append(def.toOpt(i)));

        $sel.val(EditorState[group][prop]);

        $sel.on('change', function () {
            EditorState[group][prop] = +this.value;
            sendParticleAndEmitterToPico8();
        });
    });
}

function setupMenuButtons() {
    var $buttons = $('.menu-btn');

    $buttons.on('click', function () {
        var idx = $buttons.index(this);

        // reset all buttons to blue, then make this one red
        $buttons
            .removeClass('orange').addClass('blue')
            .eq(idx).removeClass('blue').addClass('orange');

        // hide all editors, then show the one at idx
        $('#editor_panel').children('[id$="_editor"]')
            .addClass('invisible')
            .eq(idx).removeClass('invisible');
    });
}

// populate either the 'particle' or the 'emitter' list
function populateList(type) {
    // derive all the bits from "type"
    const plural = type + 's';
    const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
    const items = EditorState[plural];
    const currentKey = 'current' + capitalize(type) + 'Id';
    const currentId = EditorState[currentKey];
    const selectFn = window['select' + capitalize(type)];

    const $list = $(`#${type}_list_col`);
    const itemClass = `${type}-item`;
    const nameClass = `${type}-name`;
    const delClass = `${type}-delete`;

    // clear old
    $list.find(`.${itemClass}`).remove();

    items.forEach(obj => {
        const isCurrent = obj.id === currentId;
        const isZero = obj.id === 0;

        const $row = $(`
      <div class="row ${itemClass}" data-id="${obj.id}">
        <div class="base ${isCurrent ? 'orange' : 'blue'} interactive button flex-2 ${nameClass}">
          ${obj.name}
        </div>
        <div class="base ${isZero ? 'gray' : 'red'} interactive button flex-1 ${delClass}" ${isZero ? 'disabled' : ''}>
          delete
        </div>
      </div>
    `);
        $list.children().last().before($row);
    });

    // delegate clicks
    $list
        .off('click', `.${nameClass}`)
        .on('click', `.${nameClass}`, function () {
            const id = $(this).closest(`.${itemClass}`).data('id');
            selectFn(id);
        })
        .off('click', `.${delClass}`)
        .on('click', `.${delClass}`, function () {
            if ($(this).is('[disabled]')) return;
            const id = $(this).closest(`.${itemClass}`).data('id');

            // remove & refresh/select
            EditorState[plural] = items.filter(o => o.id !== id);

            if (currentId === id) {
                (0);
            } else {
                populateList(type);
            }
        });
}

function selectParticle(id) {
    // Find the particle by id
    const particle = EditorState.particles.find(p => p.id === id);
    if (!particle) return;

    // Update the current particle ID
    EditorState.currentParticleId = id;

    // Update the particle object
    EditorState.particle = {
        kind: particle.kind,
        life: particle.life,
        size: particle.size,
        color: particle.color,
        physics: particle.physics
    };

    // Update the form fields
    $('#select_particle_name').val(particle.name);
    $('#select_particle_kind').val(particle.kind);
    $('#select_particle_life').val(particle.life);
    $('#select_particle_size').val(particle.size);
    $('#select_particle_color').val(particle.color);
    $('#select_particle_physics').val(particle.physics);

    // Update the particle list to highlight the selected particle
    populateList('particle');

    // Send the updated particle and emitter to PICO-8
    sendParticleAndEmitterToPico8();
}

function selectEmitter(id) {
    // Find the emitter by id
    const emitter = EditorState.emitters.find(e => e.id === id);
    if (!emitter) return;

    // Update the current emitter ID
    EditorState.currentEmitterId = id;

    // Update the emitter object
    EditorState.emitter = {
        burst: emitter.burst,
        spread: emitter.spread,
        cone: emitter.cone,
        delay: emitter.delay,
        update: emitter.update,
        override: emitter.override
    };

    // Update the form fields
    $('#select_emitter_name').val(emitter.name);
    $('#select_emitter_burst').val(emitter.burst);
    $('#select_emitter_spread').val(emitter.spread);
    $('#select_emitter_cone').val(emitter.cone);
    $('#select_emitter_delay').val(emitter.delay);
    $('#select_emitter_update').val(emitter.update);
    $('#select_emitter_override').val(emitter.override);

    // Update the emitter list to highlight the selected emitter
    populateList('emitter');

    // Send the updated particle and emitter to PICO-8
    sendParticleAndEmitterToPico8();
}

function createNewParticle() {
    const newId = EditorState.particles.length > 0
        ? Math.max(...EditorState.particles.map(p => p.id)) + 1
        : 1;

    EditorState.particles.push({
        id: newId,
        name: `particle ${newId}`,
        kind: 0,
        life: 0,
        size: 0,
        color: 0,
        physics: 0
    });

    selectParticle(newId);
}

function createNewEmitter() {
    const newId = EditorState.emitters.length > 0
        ? Math.max(...EditorState.emitters.map(e => e.id)) + 1
        : 1;

    EditorState.emitters.push({
        id: newId,
        name: `emitter ${newId}`,
        burst: 0,
        spread: 0,
        cone: 0,
        delay: 0,
        update: 0,
        override: 0
    });

    selectEmitter(newId);
}

// update particle properties when a dropdown changes
function updateParticleProperty(property, value) {
    EditorState.particle[property] = value;

    const particle = EditorState.particles.find(p => p.id === EditorState.currentParticleId);
    if (particle) {
        particle[property] = value;
    }

    sendParticleAndEmitterToPico8();
}

// update emitter properties when a dropdown changes
function updateEmitterProperty(property, value) {
    EditorState.emitter[property] = value;

    const emitter = EditorState.emitters.find(e => e.id === EditorState.currentEmitterId);
    if (emitter) {
        emitter[property] = value;
    }

    sendParticleAndEmitterToPico8();
}

function setupParticleAndEmitterLists() {
    // initialize particle list
    $('#particle_list_col').find('.base.green.interactive.button').click(createNewParticle);
    $('#select_particle_name').on('input', () => {
        const particle = EditorState.particles.find(p => p.id === EditorState.currentParticleId);
        if (particle) {
            particle.name = $('#select_particle_name').val();
            populateList('particle');
        }
    });

    // initialize emitter list
    $('#emitter_list_col').find('.base.green.interactive.button').click(createNewEmitter);
    $('#select_emitter_name').on('input', () => {
        const emitter = EditorState.emitters.find(e => e.id === EditorState.currentEmitterId);
        if (emitter) {
            emitter.name = $('#select_emitter_name').val();;
            populateList('emitter');
        }
    });

    // add event listeners for particle properties
    ['kind', 'life', 'size', 'color', 'physics'].forEach(property => {
        $(`#select_particle_${property}`).on('change', function () {
            updateParticleProperty(property, parseInt($(this).val()));
        });
    });

    // add event listeners for emitter properties
    ['burst', 'spread', 'cone', 'delay', 'update', 'override'].forEach(property => {
        $(`#select_emitter_${property}`).on('change', function () {
            updateEmitterProperty(property, parseInt($(this).val()));
        });
    });
}

// central JSON download
function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// load the state from a JSON file, repopulate the EditorState and refresh UI
function loadAll() {
    const file = this.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const state = JSON.parse(e.target.result);
            // Merge loaded state
            Object.assign(EditorState, state);

            // Refresh UI from EditorState
            updateColorMode();
            populateColorPicker(EditorState.currentPalette);
            populateList('particle');
            populateList('emitter');
            sendPaletteUpdate();
            sendParticleAndEmitterToPico8();
        } catch (err) {
            console.error('Invalid state file', err);
        }
        $('#load_input').val('');
    };
    reader.readAsText(file);
}

function updateColorMode() {
    document.documentElement.classList.toggle('extended-mode', EditorState.editorProps.extendedMode);
    $('#color_mode_button').text("color mode: " + (EditorState.editorProps.extendedMode ? 'extended' : 'basic'));
}

// once the page is loaded
$(function () {
    setupResetButton();

    // generator panel
    $('#left_side_switch').click(() => toggleSideButton('#left_side_switch', 'leftOpen'));
    $('#right_side_switch').click(() => toggleSideButton('#right_side_switch', 'rightOpen'));
    $('#top_side_switch').click(() => toggleSideButton('#top_side_switch', 'topOpen'));
    $('#bottom_side_switch').click(() => toggleSideButton('#bottom_side_switch', 'bottomOpen'));

    $('#force_slider').on('input', function () {
        EditorState.worldProps.force = $(this).val();
        $('#force_label').text(`force: ${(EditorState.worldProps.force * (4 / 256)).toFixed(4)}`); // convert back to 0 - 4
    });
    $('#force_slider').on('change', sendForceUpdate);

    $('#density_slider').on('input', function () {
        EditorState.worldProps.density = $(this).val();
        $('#density_label').text(`density: ${(0.47 + EditorState.worldProps.density * (0.06 / 256)).toFixed(4)}`); // convert back to 0.47–0.53
    });

    $('#strength_slider').on('input', function () {
        EditorState.worldProps.strength = $(this).val();
        $('#strength_label').text(`world str: ${(EditorState.worldProps.strength * (2 / 256)).toFixed(2)}`); // Convert back to 0-2
    });

    initColorPicker('#base-color', p8Colors);
    initColorPicker('#highlight-color', p8Colors);
    initColorPicker('#background-color', p8ExtColors);
    initColorPicker('#damage-color', p8Colors);
    populateColorPicker(EditorState.currentPalette);
    $('#base-color, #highlight-color, #background-color, #damage-color, #strength_slider').on('change', sendPaletteUpdate);
    $('#palette-list')
        .val('1')   // start on palette #1
        .on('change', function () {
            EditorState.currentPalette = parseInt(this.value, 10) - 1;
            populateColorPicker(EditorState.currentPalette);
            sendPaletteUpdate();
        });

    $('#generate-btn').click(generateNewMap);

    $('#save-btn').click(() => {
        downloadJSON(EditorState, 'pico8-editor-state.json');
    });
    $('#load-btn').click(() => $('#load_state').click());
    $('#load_state').on('change', loadAll);

    // editor panel
    $('#color_mode_button').click(() => {
        EditorState.editorProps.extendedMode = !EditorState.editorProps.extendedMode;
        updateColorMode();
    });

    $('#debug_button').click(() => {
        EditorState.editorProps.debugMode = !EditorState.editorProps.debugMode;
        $('#debug_button')
            .removeClass('red green')
            .addClass(EditorState.editorProps.debugMode ? 'green' : 'red')
            .text(EditorState.editorProps.debugMode ? 'debug: on' : 'debug: off');
        p8(DEBUG_FN, EditorState.editorProps.debugMode)
    });

    populateOptSelectors();

    setupMenuButtons();

    setupParticleAndEmitterLists();

    populateList('particle');

    populateList('emitter');

    // start the PICO-8 call processor loop
    requestAnimationFrame(processP8Queue);
});