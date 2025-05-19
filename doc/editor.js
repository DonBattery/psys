// — tell Emscripten which canvas to use —
var Module = { canvas: document.getElementById('canvas') };

// PICO-8 API
window.pico8_gpio = new Uint8Array(128);
const _pico8Queue = [];
const led = document.getElementById('led');

// enqueue a call to Pico-8 (function ID, number of params, list of params)
function p8(fn_id, numInputs, inputs) {
    if (!Array.isArray(inputs) || inputs.length < numInputs) {
        console.warn('p8: inputs must be array of length ≥ numInputs');
        return;
    }
    _pico8Queue.push({ fn_id, numInputs, inputs });
}

// process the PICO-8 call queue on every frame
function processPico8Queue() {
    const gpio = window.pico8_gpio;
    // if PICO-8 is ready to read, and we have something in the queue
    if (gpio[0] === 1 && _pico8Queue.length) {
        // get the first call from the queue
        const { fn_id, numInputs, inputs } = _pico8Queue.shift();
        // set the first pin to "processing"
        gpio[0] = 2;
        // set the second pin to the function ID
        gpio[1] = fn_id & 0xFF;
        // set the third pin to the number of inputs
        gpio[2] = numInputs & 0xFF;
        // write the arguments of the call from the forth pin
        inputs.forEach((v, i) => gpio[3 + i] = v & 0xFF);
    }
    // update the LED (0: not ready/red, 1: ready/green, 2: processing/blue)
    $(led).attr('class', ['red', 'green', 'blue'][gpio[0]]);
    requestAnimationFrame(processPico8Queue);
}

// — once DOM is ready, wire up everything —
$(function () {
    // your PICO-8 palettes
    const pico8Std = [
        "#000000", "#1d2b53", "#7e2553", "#008751",
        "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
        "#ff004d", "#ffa300", "#ffec27", "#00e436",
        "#29adff", "#83769c", "#ff77a8", "#ffccaa"
    ];
    const pico8Ext = [
        "#291814", "#111d35", "#422136", "#125359",
        "#742f29", "#49333b", "#a28879", "#f3ef7d",
        "#be1250", "#ff6c24", "#a8e72e", "#00b543",
        "#065ab5", "#754665", "#ff6e59", "#ff9d81"
    ];

    // helper: populate a selected color picker with a palette & set default
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

        // whenever the user picks one, update BOTH the preview swatch AND the <select> styling itself
        $sel.on('change', function () {
            const idx = +this.value;
            const col = palette[idx];
            const selTextColor = (idx === 7 ? 'var(--c0)' : 'var(--c7)');
            // swatch
            $(`${selectId}-preview`).css('background', col);
            // closed-select look
            $sel.css({
                'background-color': col,
                'color': selTextColor
            });
        });

        // fire once so the closed-select shows up correctly at startup
        $sel.trigger('change');
    }

    initColorPicker('#base-color', pico8Std, 4);
    initColorPicker('#highlight-color', pico8Std, 3);
    initColorPicker('#background-color', pico8Ext, 0);
    initColorPicker('#damage-color', pico8Std, 0);

    // initialize the 10 palettes
    const palettes = Array.from({ length: 10 }, () => ({
        base: pico8Std[4],
        highlight: pico8Std[3],
        background: pico8Ext[0],
        damage: pico8Std[0]
    }));
    let currentPalette = 0;  // 0 = “palette-1”, 1 = “palette-2”, …  

    // color picker dropdowns
    const pickers = [
        { key: 'base', arr: pico8Std },
        { key: 'highlight', arr: pico8Std },
        { key: 'background', arr: pico8Ext },
        { key: 'damage', arr: pico8Std }
    ];

    // bind each picker’s change → save into palettes[currentPalette]
    pickers.forEach(({ key }) => {
        $(`#${key}-color`).on('change', function () {
            const c = $(this).find(':selected').data('color');
            palettes[currentPalette][key] = c;
        });
    });

    // loadPalette: loop pickers → set .val() & trigger preview
    function loadPalette(idx) {
        const p = palettes[idx];
        pickers.forEach(({ key, arr }) => {
            const optionIndex = arr.indexOf(p[key]);
            $(`#${key}-color`)
                .val(optionIndex)
                .trigger('change');
        });
    }

    // wire up palette dropdown (value 1–10 → idx 0–9)
    $('#palette-select')
        .val('1')         // default to “palette-1”
        .on('change', function () {
            currentPalette = parseInt(this.value, 10) - 1;
            loadPalette(currentPalette);
        });

    // load the initial palette
    loadPalette(currentPalette);

    // helper: send updated palette & strength to PICO-8 (fn_id = 2)
    function sendPaletteUpdate() {
        // read the four pickers as ints
        const c1 = +$('#base-color').val();
        const c2 = +$('#highlight-color').val();
        const c3 = +$('#background-color').val();
        const c4 = +$('#damage-color').val();

        // read & byte-convert world strength (0–2 → 0–255)
        const rawW = parseFloat($('#world-strength-slider').val());
        const byteWorld = Math.round(
            Math.max(0, Math.min(255, (rawW / 2) * 255))
        );

        // fn_id=2, numInputs=5
        p8(2, 5, [c1, c2, c3, c4, byteWorld]);
    }

    // whenever any color picker changes…
    $('#base-color, #highlight-color, #background-color, #damage-color').on('change', sendPaletteUpdate);

    // …and whenever the world-strength slider moves
    $('#world-strength-slider').on('mouseup', sendPaletteUpdate);


    // density slider
    $('#density-slider').on('input', () => {
        $('#density-value').text($('#density-slider').val());
    });

    // world strength slider
    $('#world-strength-slider').on('input', () => {
        $('#world-strength-value').text($('#world-strength-slider').val());
    });

    // generate button


    $('#generate-btn').click(function () {
        // density → byte
        const rawD = parseFloat($('#density-slider').val());
        const byteDensity = Math.round(Math.max(0, Math.min(255, (rawD - 0.48) / 0.04 * 255)));
        // world strength → byte
        const rawW = parseFloat($('#world-strength-slider').val());
        const byteWorld = Math.round(Math.max(0, Math.min(255, (rawW / 2) * 255)));
        p8(1, 10, [
            byteDensity,
            $('#left-switch').is(':checked'),
            $('#right-switch').is(':checked'),
            $('#top-switch').is(':checked'),
            $('#bottom-switch').is(':checked'),
            $('#base-color').val(),
            $('#highlight-color').val(),
            $('#background-color').val(),
            $('#damage-color').val(),
            byteWorld
        ]);
    });

    // tab switching
    $('.tab-btn').click(function () {
        const t = $(this).data('target');
        $('.tab-btn').removeClass('active');
        $(this).addClass('active');
        $('.tab-content').removeClass('active');
        $('#' + t).addClass('active');
    });

    // start the PICO-8 call processor loop
    requestAnimationFrame(processPico8Queue);
});