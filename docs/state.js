let EditorState = {
    resetTimer: null,

    currentPalette: 0,
    currentParticle: 0,
    currentEmitter: 0,

    // editor properties
    editorProps: {
        extendedMode: false,
        debugMode: false,
    },

    // world properties
    worldProps: {
        leftOpen: true,
        rightOpen: true,
        topOpen: true,
        bottomOpen: true,
        density: 0.5,
        worldStrength: 1,
        force: 1,
    },

    // particle properties
    particleProps: {
        kind: {
            toOpt(idx) {
                const label = this.values[idx];
                return `<option value="${idx}">${label}</option>`;
            },
            lua_name: "p_kinds",
            values: [
                'pixel',
                'circle',
                'filled circle',
                'square',
                'line',
                'colored circle',
                'line with point',
                'rotating line with point'
            ]
        },

        life: {
            toOpt(idx) {
                const [min, max] = this.values[idx];
                return `<option value="${idx}">${min} - ${max} frames</option>`;
            },
            lua_name: "p_lifes",
            values: [
                [6, 12],
                [12, 24],
                [24, 32],
                [32, 58],
                [58, 84],
                [90, 120],
                [120, 180],
                [180, 240]
            ]
        },

        size: {
            toOpt(idx) {
                const arr = this.values[idx];
                return `<option value="${idx}">${arr.join(" ")}</option>`;
            },
            lua_name: "p_sizes",
            values: [
                [0],
                [1, 1, 0],
                [0, 1, 1],
                [1, 2, 3, 2, 1],
                [3, 4, 3, 2, 1],
                [4, 5, 4, 3, 2],
                [2, 1, 1],
                [2, 3, 2, 1],
                [2],
                [7, 6, 5, 4, 3, 2, 1, 0],
                [11, 9, 7, 5, 4, 3, 2, 1, 0],
                [3],
                [4],
                [1, 2, 3, 5, 7],
                [1, 2, 3, 4, 5, 7, 9, 11],
                [1, 2, 3, 4, 5, 7, 9, 11, 15, 17]
            ]
        },

        color: {
            toOpt(idx) {
                const arr = this.values[idx];
                return `<option value="${idx}">${arr.join(" ")}</option>`;
            },
            lua_name: "p_colors",
            values: [
                [7],
                [7, 15],
                [5],
                [7, 6, 5],
                [7, 10, 9],
                [10, 9],
                [10, 9, 5],
                [10, 9, 8, 2],
                [7, 10, 9, 8, 2, 5],
                [8, 2],
                [12],
                [12, 13, 5],
                [11, 10],
                [11, 3],
                [7, 11],
                [6, 4]
            ]
        },

        physics: {
            toOpt(idx) {
                const name = this.values[idx].name;
                return `<option value="${idx}">${name}</option>`;
            },
            lua_name: "phy_params",
            values: [
                {
                    "name": "static",
                    "spd": [0, 0, 0, 0],
                    "gra": 0,
                    "fri": 1,
                    "mul": 0.2
                },
                {
                    "name": "floating up",
                    "spd": [-0.1, 0.1, -0.3, -0.1],
                    "gra": -0.005,
                    "fri": 1.001,
                    "mul": 0.6
                },
                {
                    "name": "spreading",
                    "spd": [-0.5, 0.5, -0.4, -0.7],
                    "gra": 0.02,
                    "fri": 0.999,
                    "mul": 0.7
                },
                {
                    "name": "spreading lightly",
                    "spd": [-0.3, 0.3, -0.1, -0.2],
                    "gra": 0.02,
                    "fri": 0.98,
                    "mul": 0.9
                }
            ]
        }
    },

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

    // emitter properties
    emitterProps: {
        burst: {
            toOpt(idx) {
                return `<option value="${idx}">${this.values[idx]}</option>`;
            },
            lua_name: "e_bursts",
            values: [
                1,
                2,
                3,
                5,
                7,
                9,
                13,
                21
            ],
        },

        spread: {
            toOpt(idx) {
                return `<option value="${idx}">${this.values[idx]}</option>`;
            },
            lua_name: "e_spreads",
            values: [
                0,
                2,
                5,
                9
            ],
        },

        cone: {

            toOpt(idx) {
                return `<option value="${idx}">${this.values[idx]}</option>`;
            },
            lua_name: "e_cones",
            values: [
                0,
                0.001,
                0.01,
                0.02,
                0.1,
                0.25,
                0.15,
                0.2
            ],
        },

        delay: {
            toOpt(idx) {
                const [min, max] = this.values[idx];
                return `<option value="${idx}">${min} - ${max} frames</option>`;
            },
            lua_name: "e_delays",
            values: [
                [0, 0],
                [3, 6],
                [6, 12],
                [12, 24]
            ],
        },

        update: {
            toOpt(idx) {
                const arr = this.values[idx];
                return `<option value="${idx}">${arr.join(", ")}</option>`;
            },
            lua_name: "e_upd_fns",
            values: [
                ["neutral"],
                ["smoker"],
                ["smoker", "end_smoker"],
                ["burner"],
                ["painter"],
                ["bouncer"]
            ]
        },

        override: {
            toOpt(idx) {
                const name = this.values[idx].name;
                return `<option value="${idx}">${name}</option>`;
            },
            lua_name: "phy_params",
            values: [
                {
                    "name": "no override",
                    "spd": [0, 0, 0, 0],
                    "gra": 0,
                    "fri": 0,
                    "mul": 0
                },
                {
                    "name": "exploding",
                    "spd": [-1.2, 1.2, -1.6, 0.2],
                    "gra": 0.05,
                    "fri": 0.99,
                    "mul": 1
                },
                {
                    "name": "projectile a",
                    "spd": [0, 0, 0, 0],
                    "gra": 0.002,
                    "fri": 1,
                    "mul": 1.2
                },
                {
                    "name": "projectile b",
                    "spd": [-0.2, 0.2, -0.2, 0.2],
                    "gra": 0.02,
                    "fri": 0.985,
                    "mul": 1
                }
            ]
        }
    },

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
    ],

    palettes: Array.from({ length: 10 }, () => ({
        base: 4,
        highlight: 3,
        background: 0,
        damage: 0
    })),

    pickers: [
        { key: 'base', arr: p8Colors },
        { key: 'highlight', arr: p8Colors },
        { key: 'background', arr: p8ExtColors },
        { key: 'damage', arr: p8Colors }
    ]
}