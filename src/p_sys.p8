pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
fns = {
  function(density, left, right, top, down, color1, color2, color3, color4, str)
    pprint("chaos emerges,", 24, 26, 11, 0, "l", true)
    pprint("last war approaches", 28, 35, 11, 0, "l", true)
    flip()
    base_color, highlight_color, bg_color, dmg_color, world_str = color1, color2, color3, color4, str
    gen_map(.48 + density * (.04 / 256), color1, color2, left == 1, right == 1, top == 1, down == 1)
  end,
  function(color1, color2, color3, color4, str)
    for x = 0, 127 do
      for y = 8, 119 do
        c = get_px(x, y)
        if c ~= 1 then
          set_px(x, y, c == highlight_color and color2 or c == dmg_color and color3 or color1)
        end
      end
    end
    base_color, highlight_color, bg_color, dmg_color, world_str = color1, color2, color3, color4, str
  end
}

function gpio_stack()
  return env({
    upd = function(_ENV)
      local pin1 = peek(0x5f80)
      if pin1 == 0 then
        poke(0x5f80, 1)
      elseif pin1 == 2 then
        local fn, number_of_params = peek(0x5f81), peek(0x5f82)
        local params = {}
        for i = 1, number_of_params do
          add(params, peek(0x5f82 + i))
        end
        fns[fn](unpack(params))
        poke(0x5f80, 1)
      end
    end
  })
end

function _init()
  gpio = gpio_stack()
  init_destructors()
  gen_map(.5, 4, 3, true, true, true, true)
  joy1 = joy(0)
  joy2 = joy(1)
  fg_part, bg_part = p_sys(), p_sys()
  ui = new_ui()

  focus = v2(64, 64)
  spd = v2()
  p_dir = v2(0, 0)
  p_force = 0
  bg_color = 1
end

function _update60()
  gpio:upd()
  bg_part:upd()
  fg_part:upd()
  joy1:upd()
  joy2:upd()

  if joy1.l.down then
    spd.x = max(-4, spd.x - .1)
  end
  if joy1.r.down then
    spd.x = min(4, spd.x + .1)
  end
  if joy1.u.down then
    spd.y = max(-4, spd.y - .1)
  end
  if joy1.d.down then
    spd.y = min(4, spd.y + .1)
  end

  spd.x = spd.x * .85
  if abs(spd.x) < .01 then spd.x = 0 end

  spd.y = spd.y * .85
  if abs(spd.y) < .01 then spd.y = 0 end

  focus.x = mid(0, focus.x + spd.x, 127)
  focus.y = mid(0, focus.y + spd.y, 127)

  if (ui.lmbtn.clicked or ui.rmbtn.isdown) and p_coll(ui.mpos, { pos = v2(0, 8), size = v2(128, 112) }) then
    emit(
      focus, encode_particle({
        kind = 5,
        life = 7,
        size = 0,
        color = 13,
        phy = 3
      }), encode_emitter({
        on_upd = 5
      }), p_dir, p_force
    )
  end
end

function _draw()
  cls(1)

  rectfill(0, 0, 127, 8, 0)
  rectfill(0, 120, 127, 127, 0)
  memcpy(0x6200, 0x8200, 0x1C00)

  bg_part:draw()
  line(0, focus.y, 127, focus.y, 5)
  line(focus.x, 0, focus.x, 127, 5)

  local bg_n, fg_n = #bg_part.pts, #fg_part.pts
  pprint("particles", 2, 1, 12, 1, "l", true)
  pprint("bg:" .. bg_n, 45, 1, 12, 1, "l", true)
  pprint("fg:" .. fg_n, 72, 1, 12, 1, "l", true)
  pprint("all:" .. bg_n + fg_n, 99, 1, 12, 1, "l", true)

  local cpu = stat(1)
  local c1, c2 = cpu < .8 and 11 or cpu < 1 and 10 or 8, cpu < .8 and 3 or cpu < 1 and 4 or 2
  pprint("cpu:" .. stat(1), 2, 122, c1, c2, "l", true)
  pprint("mem:" .. stat(0), 48, 122, c1, c2, "l", true)
  pprint("fps:" .. stat(7), 102, 122, c1, c2, "l", true)

  fg_part:draw()
  ui:draw()

  line(focus.x, focus.y, ui.mouse_x, ui.mouse_y, p_force == 0 and 7 or p_force < 1 and 10 or p_force < 2 and 9 or 8)

  local dist = sqrt(focus:sqrdist(ui.mpos))
  p_dir, p_force = ui.mpos - focus, dist < 16 and 0 or (dist - 16) / 32

  pal(1, bg_color + 128, 1)
end
