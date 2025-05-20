"use strict";

// — tell Emscripten which canvas to use —
var Module = { canvas: document.getElementById('canvas') };

// PICO-8 API //

// the 128 GPIO pin, each represented with a byte, both available for the web page and the running PICO-8 instance
window.pico8_gpio = new Uint8Array(128);

// FIFO pipe to send function calls to the running PICO-8 instance
const p8Queue = [];

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

// enqueue a call to PICO-8 (function ID, number of params, list of params)
function p8(fnID, numInputs, inputs) {
    if (!Array.isArray(inputs) || inputs.length < numInputs) {
        console.warn('p8: inputs must be array of length ≥ numInputs');
        return;
    }
    p8Queue.push({ fnID, numInputs, inputs });
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

    requestAnimationFrame(processP8Queue);
}

// Editor API //

// The generator panel's state
let Generator = {
    leftOpen: true,
    rightOpen: true,
    topOpen: true,
    bottomOpen: true,
    density: 0.5
}
// initialize the 10 palettes
const palettes = Array.from({ length: 10 }, () => ({
    base: p8Colors[4],
    highlight: p8Colors[3],
    background: p8ExtColors[0],
    damage: p8Colors[0]
}));
let currentPalette = 0;  // 0 = “palette-1”, 1 = “palette-2”, …  

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
    const isOpen = Generator[stateKey];

    // Remove one class and add the other
    $button.removeClass(isOpen ? 'green' : 'red')
        .addClass(isOpen ? 'red' : 'green');

    Generator[stateKey] = !isOpen;
}

function generateNewMap() {
    // density → byte (470-530 → 0-255)
    const rawD = parseFloat($('#density_slider').val());
    const byteDensity = Math.round(((rawD - 470) / 60) * 255);

    // world strength → byte (0-200 → 0-255)
    const rawW = parseFloat($('#strength_slider').val());
    const byteWorld = Math.round((rawW / 200) * 255);
    p8(1, 10, [
        byteDensity,
        Generator.leftOpen ? 0 : 1,
        Generator.rightOpen ? 0 : 1,
        Generator.topOpen ? 0 : 1,
        Generator.bottomOpen ? 0 : 1,
        +$('#base-color').val(),
        +$('#highlight-color').val(),
        +$('#background-color').val(),
        +$('#damage-color').val(),
        byteWorld
    ]);
}

// send updated palette & strength to PICO-8 (fn_id = 2)
function sendPaletteUpdate() {
    // read & byte-convert world strength (0–2 → 0–255)
    const rawW = parseFloat($('#strength_slider').val());
    const byteWorld = Math.round(
        Math.max(0, Math.min(255, (rawW / 2) * 255))
    );

    p8(2, 5, [
        +$('#base-color').val(),
        +$('#highlight-color').val(),
        +$('#background-color').val(),
        +$('#damage-color').val(),
        byteWorld
    ]);
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
        $(`#${key}-color`)
            .val(arr.indexOf(palettes[idx][key]))
            .trigger('change');
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
                populateColorPicker(currentPalette);
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
};

function setupMenuButtons() {
    var $buttons = $('.menu-btn');

    $buttons.on('click', function () {
        var idx = $buttons.index(this);

        // reset all buttons to blue, then make this one red
        $buttons
            .removeClass('red').addClass('blue')
            .eq(idx).removeClass('blue').addClass('red');

        // hide all editors, then show the one at idx
        $('#editor_panel').children('[id$="_editor"]')
            .addClass('invisible')
            .eq(idx).removeClass('invisible');
    });
}

// once the page is loaded
$(function () {
    $('#left_side_switch').click(() => toggleSideButton('#left_side_switch', 'leftOpen'));
    $('#right_side_switch').click(() => toggleSideButton('#right_side_switch', 'rightOpen'));
    $('#top_side_switch').click(() => toggleSideButton('#top_side_switch', 'topOpen'));
    $('#bottom_side_switch').click(() => toggleSideButton('#bottom_side_switch', 'bottomOpen'));

    $('#density_slider').on('input', function () {
        Generator.density = $(this).val() / 1000; // Convert back to 0.47–0.53
        $('#density_label').text(`density: ${Generator.density}`)
    });

    $('#strength_slider').on('input', function () {
        Generator.strength = $(this).val() / 100; // Convert back to 0-2
        $('#strength_label').text(`world str: ${Generator.strength}`)
    });

    initColorPicker('#base-color', p8Colors, 4);
    initColorPicker('#highlight-color', p8Colors, 3);
    initColorPicker('#background-color', p8ExtColors, 0);
    initColorPicker('#damage-color', p8Colors, 0);

    // bind each picker’s change → save into palettes[currentPalette]
    pickers.forEach(({ key }) => {
        $(`#${key}-color`).on('change', function () {
            const c = $(this).find(':selected').data('color');
            palettes[currentPalette][key] = c;
        });
    });

    // wire up palette dropdown (value 1–10 → idx 0–9)
    $('#palette-list')
        .val('1')         // default to “palette-1”
        .on('change', function () {
            currentPalette = parseInt(this.value, 10) - 1;
            populateColorPicker(currentPalette);
        });

    // load the initial palette
    populateColorPicker(currentPalette);

    $('#base-color, #highlight-color, #background-color, #damage-color').on('change', sendPaletteUpdate);

    $('#generate-btn').click(generateNewMap);

    $('#save-btn').click(savePalettes);

    $('#load_palette_input').on('change', loadPalettes);

    $('#load-btn').click(() => $('#load_palette_input').click());

    setupMenuButtons();

    // start the PICO-8 call processor loop
    requestAnimationFrame(processP8Queue);
});