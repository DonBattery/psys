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

    // update the LED (0: not ready/red, 1: ready/green, 2: processing/blue)
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

// helper to split a 16-bit word into [lo, hi]
function bytesFrom(word) {
    return [word & 0xFF, (word >> 8) & 0xFF];
}

// Editor API //
let Editor = {
    currentPalette: 0,
    currentParticle: 0,
    currentEmitter: 0,

    particle: {
        id: 0,
        name: "default particle",
        kind: 5,
        life: 7,
        size: 0,
        color: 13,
        physics: 3
    },

    particles: [
        {
            id: 0,
            name: "default particle",
            kind: 5,
            life: 7,
            size: 0,
            color: 13,
            physics: 3
        }
    ],

    emitter: {
        id: 0,
        name: "default emitter",
        burst: 0,
        spread: 0,
        cone: 0,
        delay: 0,
        update: 5,
        override: 0
    },

    emitters: [
        {
            id: 0,
            name: "default emitter",
            burst: 0,
            spread: 0,
            cone: 0,
            delay: 0,
            update: 5,
            override: 0
        }
    ]
};

// initialize the 10 palettes
const palettes = Array.from({ length: 10 }, () => ({
    base: p8Colors[4],
    highlight: p8Colors[3],
    background: p8ExtColors[0],
    damage: p8Colors[0]
}));


// color picker dropdowns
const pickers = [
    { key: 'base', arr: p8Colors },
    { key: 'highlight', arr: p8Colors },
    { key: 'background', arr: p8ExtColors },
    { key: 'damage', arr: p8Colors }
];

// toggle the map sides (open or closed)
function toggleSideButton(button, stateKey) {
    const $button = $(button);
    const isOpen = EditorData.worldProps[stateKey];

    // Remove one class and add the other
    $button.removeClass(isOpen ? 'green' : 'red')
        .addClass(isOpen ? 'red' : 'green');

    EditorData.worldProps[stateKey] = !isOpen;
}

// tell PICO-8 to generate a new map
function generateNewMap() {
    p8(GEN_FN, [
        +$('#density_slider').val(),
        EditorData.worldProps.leftOpen ? 0 : 1,
        EditorData.worldProps.rightOpen ? 0 : 1,
        EditorData.worldProps.topOpen ? 0 : 1,
        EditorData.worldProps.bottomOpen ? 0 : 1,
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
function initColorPicker(selectId, palette, defaultIdx) {
    const $sel = $(selectId);
    palette.forEach((col, i) => {
        // text is white by default, except for the 8th (i===7) which must be black
        const textColor = (i === 7 ? 'var(--c0)' : 'var(--c7)');
        $sel.append(
            `<option
          value="${i}"
          data-color="${col}"
          style="background-color:${col}; color:${textColor}"
       >${i}</option>`
        );
    });
    // set default
    $sel.val(defaultIdx);

    $sel.on('change', function () {
        const idx = +this.value;
        const col = palette[idx];
        const selTextColor = (idx === 7 ? 'var(--c0)' : 'var(--c7)');
        $sel.css({
            'background-color': col,
            'color': selTextColor
        });
    });

    // fire once so the closed-select shows up correctly at startup
    $sel.trigger('change');
}

// populateColorPicker: loop pickers → set .val() & trigger preview
function populateColorPicker(idx) {
    pickers.forEach(({ key, arr }) => {
        $(`#${key}-color`).val(arr.indexOf(palettes[idx][key])).trigger('change');
    });
}

function savePalettes() {
    // build an index‐only version of the palettes
    const indexPalettes = palettes.map(p => ({
        base: p8Colors.indexOf(p.base),
        highlight: p8Colors.indexOf(p.highlight),
        background: p8ExtColors.indexOf(p.background),
        damage: p8Colors.indexOf(p.damage)
    }));
    const json = JSON.stringify(indexPalettes, null, 2);

    // download as JSON
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pico8-palettes.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function sendParticleAndEmitterToPico8() {
    // encode both current particle & emitter words
    const partWord = encodeParticle(Editor.particle);
    const emitWord = encodeEmitter(Editor.emitter);

    // split into [lo,hi] bytes
    const [pLo, pHi] = bytesFrom(partWord);
    const [eLo, eHi] = bytesFrom(emitWord);

    // send all four bytes to EMITTER_FN
    p8(EMITTER_FN, [pLo, pHi, eLo, eHi]);
}

function populateOptSelectors() {

    // auto wiring of the <select> dropdowns:
    $('.particle-opts').each(function () {
        // e.g. id = "select_particle_kind"  or  "select_emitter_update"
        const [, group, prop] = this.id.split('_');
        const defs = EditorData[group + 'Props'];
        const def = defs && defs[prop];

        const $sel = $(this);

        def.values.forEach((_, i) => $sel.append(def.toOpt(i)));

        $sel.val(Editor[group][prop]);

        $sel.on('change', function () {
            Editor[group][prop] = +this.value;
            sendParticleAndEmitterToPico8();
        });
    });
}

function loadPalettes() {
    const file = this.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const loaded = JSON.parse(e.target.result);
            // validate: must be array of length 10
            if (Array.isArray(loaded) && loaded.length === palettes.length) {
                loaded.forEach((lp, i) => {
                    // rehydrate hex values from indices
                    palettes[i].base = p8Colors[lp.base];
                    palettes[i].highlight = p8Colors[lp.highlight];
                    palettes[i].background = p8ExtColors[lp.background];
                    palettes[i].damage = p8Colors[lp.damage];
                });
                populateColorPicker(Editor.currentPalette);
            } else {
                console.error('Invalid palette file format');
            }
        } catch (err) {
            console.error('Failed to parse JSON:', err);
        }
        // clear input so we can re-load the same file
        $('#load_palette_input').val('');
    };
    reader.readAsText(file);
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


// Function to populate the particle list
function populateParticleList() {
    const $list = $('#particle_list_col');

    // Clear existing list (except header and 'new' button)
    $list.find('.particle-item').remove();

    // Add each particle to the list
    Editor.particles.forEach(particle => {
        const $item = $(`
            <div class="row particle-item" data-id="${particle.id}">
                <div class="base ${particle.id === Editor.currentParticleId ? 'orange' : 'blue'} interactive button flex-2 particle-name">
                    ${particle.name}
                </div>
                <div class="base ${particle.id === 0 ? 'gray' : 'red'} interactive button flex-1 particle-delete" ${particle.id === 0 ? 'disabled' : ''}>
                    delete
                </div>
            </div>
        `);

        // Insert before the 'new' button
        $list.children().last().before($item);
    });

    // Attach click handlers for the particle names
    $('.particle-name').click(function () {
        const id = $(this).parent().data('id');
        selectParticle(id);
    });

    // Attach click handlers for the delete buttons
    $('.particle-delete').click(function () {
        if ($(this).attr('disabled')) return;
        const id = $(this).parent().data('id');
        deleteParticle(id);
    });
}

// Function to populate the emitter list
function populateEmitterList() {
    const $list = $('#emitter_list_row');

    // Clear existing list (except header and 'new' button)
    $list.find('.emitter-item').remove();

    // Add each emitter to the list
    Editor.emitters.forEach(emitter => {
        const $item = $(`
            <div class="row emitter-item" data-id="${emitter.id}">
                <div class="base ${emitter.id === Editor.currentEmitterId ? 'orange' : 'blue'} interactive button flex-2 emitter-name">
                    ${emitter.name}
                </div>
                <div class="base ${emitter.id === 0 ? 'gray' : 'red'} interactive button flex-1 emitter-delete" ${emitter.id === 0 ? 'disabled' : ''}>
                    delete
                </div>
            </div>
        `);

        // Insert before the 'new' button
        $list.children().last().before($item);
    });

    // Attach click handlers for the emitter names
    $('.emitter-name').click(function () {
        const id = $(this).parent().data('id');
        selectEmitter(id);
    });

    // Attach click handlers for the delete buttons
    $('.emitter-delete').click(function () {
        if ($(this).attr('disabled')) return;
        const id = $(this).parent().data('id');
        deleteEmitter(id);
    });
}

// Function to select a particle
function selectParticle(id) {
    // Find the particle by id
    const particle = Editor.particles.find(p => p.id === id);
    if (!particle) return;

    // Update the current particle ID
    Editor.currentParticleId = id;

    // Update the Editor.particle object
    Editor.particle = {
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
    populateParticleList();

    // Send the updated particle and emitter to PICO-8
    sendParticleAndEmitterToPico8();
}

// Function to select an emitter
function selectEmitter(id) {
    // Find the emitter by id
    const emitter = Editor.emitters.find(e => e.id === id);
    if (!emitter) return;

    // Update the current emitter ID
    Editor.currentEmitterId = id;

    // Update the Editor.emitter object
    Editor.emitter = {
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
    populateEmitterList();

    // Send the updated particle and emitter to PICO-8
    sendParticleAndEmitterToPico8();
}

// Function to create a new particle
function createNewParticle() {
    // Generate a new unique ID
    const newId = Editor.particles.length > 0
        ? Math.max(...Editor.particles.map(p => p.id)) + 1
        : 1;

    // Create a new particle with default values
    const newParticle = {
        id: newId,
        name: `particle ${newId}`,
        kind: 0,
        life: 0,
        size: 0,
        color: 0,
        physics: 0
    };

    // Add to the particles array
    Editor.particles.push(newParticle);

    // Select the new particle
    selectParticle(newId);
}

// Function to create a new emitter
function createNewEmitter() {
    // Generate a new unique ID
    const newId = Editor.emitters.length > 0
        ? Math.max(...Editor.emitters.map(e => e.id)) + 1
        : 1;

    // Create a new emitter with default values
    const newEmitter = {
        id: newId,
        name: `emitter ${newId}`,
        burst: 0,
        spread: 0,
        cone: 0,
        delay: 0,
        update: 0,
        override: 0
    };

    // Add to the emitters array
    Editor.emitters.push(newEmitter);

    // Select the new emitter
    selectEmitter(newId);
}

// Function to delete a particle
function deleteParticle(id) {
    // Don't delete the default particle (id 0)
    if (id === 0) return;

    // Remove the particle from the array
    Editor.particles = Editor.particles.filter(p => p.id !== id);

    // If we deleted the currently selected particle, select the default one
    if (Editor.currentParticleId === id) {
        selectParticle(0);
    } else {
        // Just update the list
        populateParticleList();
    }
}

// Function to delete an emitter
function deleteEmitter(id) {
    // Don't delete the default emitter (id 0)
    if (id === 0) return;

    // Remove the emitter from the array
    Editor.emitters = Editor.emitters.filter(e => e.id !== id);

    // If we deleted the currently selected emitter, select the default one
    if (Editor.currentEmitterId === id) {
        selectEmitter(0);
    } else {
        // Just update the list
        populateEmitterList();
    }
}

// Function to update particle name when the input changes
function updateParticleName() {
    const name = $('#select_particle_name').val();
    const particle = Editor.particles.find(p => p.id === Editor.currentParticleId);
    if (particle) {
        particle.name = name;
        populateParticleList();
    }
}

// Function to update emitter name when the input changes
function updateEmitterName() {
    const name = $('#select_emitter_name').val();
    const emitter = Editor.emitters.find(e => e.id === Editor.currentEmitterId);
    if (emitter) {
        emitter.name = name;
        populateEmitterList();
    }
}

// Function to update particle properties when a dropdown changes
function updateParticleProperty(property, value) {
    // Update the Editor.particle object
    Editor.particle[property] = value;

    // Update the stored particle
    const particle = Editor.particles.find(p => p.id === Editor.currentParticleId);
    if (particle) {
        particle[property] = value;
    }

    sendParticleAndEmitterToPico8();
}

// Function to update emitter properties when a dropdown changes
function updateEmitterProperty(property, value) {
    // Update the Editor.emitter object
    Editor.emitter[property] = value;

    // Update the stored emitter
    const emitter = Editor.emitters.find(e => e.id === Editor.currentEmitterId);
    if (emitter) {
        emitter[property] = value;
    }

    sendParticleAndEmitterToPico8();
}

// once the page is loaded
$(function () {
    // generator panel
    $('#left_side_switch').click(() => toggleSideButton('#left_side_switch', 'leftOpen'));
    $('#right_side_switch').click(() => toggleSideButton('#right_side_switch', 'rightOpen'));
    $('#top_side_switch').click(() => toggleSideButton('#top_side_switch', 'topOpen'));
    $('#bottom_side_switch').click(() => toggleSideButton('#bottom_side_switch', 'bottomOpen'));

    $('#force_slider').on('input', function () {
        EditorData.worldProps.force = $(this).val();
        $('#force_label').text(`force: ${(EditorData.worldProps.force * (4 / 256)).toFixed(4)}`); // convert back to 0 - 4
    });
    $('#force_slider').on('change', sendForceUpdate);

    $('#density_slider').on('input', function () {
        EditorData.worldProps.density = $(this).val();
        $('#density_label').text(`density: ${(0.47 + EditorData.worldProps.density * (0.06 / 256)).toFixed(4)}`); // convert back to 0.47–0.53
    });

    $('#strength_slider').on('input', function () {
        EditorData.worldProps.strength = $(this).val();
        $('#strength_label').text(`world str: ${(EditorData.worldProps.strength * (2 / 256)).toFixed(2)}`); // Convert back to 0-2
    });

    initColorPicker('#base-color', p8Colors, 4);
    initColorPicker('#highlight-color', p8Colors, 3);
    initColorPicker('#background-color', p8ExtColors, 0);
    initColorPicker('#damage-color', p8Colors, 0);

    // bind each picker’s change → save into palettes[Editor.currentPalette]
    pickers.forEach(({ key }) => {
        $(`#${key}-color`).on('change', () => {
            palettes[Editor.currentPalette][key] = $(this).find(':selected').data('color');
        });
    });

    // wire up palette dropdown (value 1–10 → idx 0–9)
    $('#palette-list')
        .val('1')         // default to “palette-1”
        .on('change', function () {
            Editor.currentPalette = parseInt(this.value, 10) - 1;
            populateColorPicker(Editor.currentPalette);
        });

    // load the initial palette
    populateColorPicker(Editor.currentPalette);

    $('#base-color, #highlight-color, #background-color, #damage-color, #strength_slider').on('change', sendPaletteUpdate);

    $('#generate-btn').click(generateNewMap);

    $('#save-btn').click(savePalettes);

    $('#load_palette_input').on('change', loadPalettes);

    $('#load-btn').click(() => $('#load_palette_input').click());

    // editor panel
    $('#color_mode_button').click(() => {
        EditorData.editorProps.extendedMode = !EditorData.editorProps.extendedMode;
        document.documentElement.classList.toggle('extended-mode', EditorData.editorProps.extendedMode);
        $('#color_mode_button').text("color mode: " + (EditorData.editorProps.extendedMode ? 'extended' : 'basic'));
    });

    $('#debug_button').click(() => {
        EditorData.editorProps.debugMode = !EditorData.editorProps.debugMode;
        $('#debug_button')
            .removeClass('red green')
            .addClass(EditorData.editorProps.debugMode ? 'green' : 'red')
            .text(EditorData.editorProps.debugMode ? 'debug: on' : 'debug: off');
        p8(DEBUG_FN, EditorData.editorProps.debugMode)
    });

    populateOptSelectors();

    setupMenuButtons();


    // Initialize particle list
    $('#particle_list_col').find('.base.green.interactive.button').click(createNewParticle);
    $('#select_particle_name').on('input', updateParticleName);

    // Initialize emitter list (note: there's a typo in HTML where it uses emitter_list_row instead of emitter_list_col)
    $('#emitter_list_row').addClass('scroll-list');
    $('#emitter_list_row').find('.base.green.interactive.button').click(createNewEmitter);
    $('#select_emitter_name').on('input', updateEmitterName);

    // Add event listeners for particle properties
    $('#select_particle_kind').on('change', function () {
        updateParticleProperty('kind', parseInt($(this).val()));
    });
    $('#select_particle_life').on('change', function () {
        updateParticleProperty('life', parseInt($(this).val()));
    });
    $('#select_particle_size').on('change', function () {
        updateParticleProperty('size', parseInt($(this).val()));
    });
    $('#select_particle_color').on('change', function () {
        updateParticleProperty('color', parseInt($(this).val()));
    });
    $('#select_particle_physics').on('change', function () {
        updateParticleProperty('physics', parseInt($(this).val()));
    });

    // Add event listeners for emitter properties
    $('#select_emitter_burst').on('change', function () {
        updateEmitterProperty('burst', parseInt($(this).val()));
    });
    $('#select_emitter_spread').on('change', function () {
        updateEmitterProperty('spread', parseInt($(this).val()));
    });
    $('#select_emitter_cone').on('change', function () {
        updateEmitterProperty('cone', parseInt($(this).val()));
    });
    $('#select_emitter_delay').on('change', function () {
        updateEmitterProperty('delay', parseInt($(this).val()));
    });
    $('#select_emitter_update').on('change', function () {
        updateEmitterProperty('update', parseInt($(this).val()));
    });
    $('#select_emitter_override').on('change', function () {
        updateEmitterProperty('override', parseInt($(this).val()));
    });

    // Populate the lists
    populateParticleList();
    populateEmitterList();

    // start the PICO-8 call processor loop
    requestAnimationFrame(processP8Queue);
});