pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
-------------------------------------- PARTICLE PROPS ---------------------------
-- 3 bit 8 possible kind
p_kinds = {
  [0] = { 0 }, -- 0 pixel
  { 1 }, -- 1 circle
  { 2 }, -- 2 filled circle
  { 3 }, -- 3 square
  { 4 }, -- 4 line
  { 5 }, -- 5 circle with point in it
  { 6 }, -- 6 line with point at the end
  { 7 } -- 7 rotating line with point at the end
}

-- 3 bit 8 possible life
p_lifes = {
  [0] = { 6, 12 },
  { 12, 24 },
  { 24, 32 },
  { 32, 58 },
  { 58, 84 },
  { 90, 120 },
  { 120, 180 },
  { 180, 240 }
}

-- 4 bit 16 possible size
p_sizes = {
  [0] = { 0 },
  { 1, 1, 0 },
  { 0, 1, 1 },
  { 1, 2, 3, 2, 1 },
  { 3, 4, 3, 2, 1 },
  { 4, 5, 4, 3, 2 },
  { 2, 1, 1 },
  { 2, 3, 2, 1 },
  { 2 },
  { 7, 6, 5, 4, 3, 2, 1, 0 },
  { 11, 9, 7, 5, 4, 3, 2, 1, 0 },
  {},
  {},
  { 1, 2, 3, 5, 7 },
  { 1, 2, 3, 4, 5, 7, 9, 11 },
  { 1, 2, 3, 4, 5, 7, 9, 11, 15, 17 }
}

-- 4 bit 16 possible color palette
p_colors = {
  [0] = { 7 }, -- 0 light / white
  { 7, 15 }, -- 7 dust
  { 5 }, -- 2 smoke A / dark gray
  { 7, 6, 5 }, -- 3 smoke B
  { 7, 10, 9 }, -- 4 flame A
  { 10, 9 }, -- 5 flame B / orange
  { 10, 9, 5 }, -- 6 flame C
  { 10, 9, 8, 2 }, -- 7 flame D
  { 7, 10, 9, 8, 2, 5 }, -- 8 flame E
  { 8, 2 }, -- 9 flame F / red
  { 12 }, -- 10 lazer B / blue
  { 12, 13, 5 }, -- 11 lazer flash B
  { 11, 10 }, -- 12 rocket
  { 11, 3 }, -- 13 acid
  { 7, 11 }, -- 14 heal
  { 6, 4 } -- 15 knife
}

-- simplified physics presets
phy_params = {
  -- 0 static
  [0] = {
    spd = { 0, 0, 0, 0 },
    gra = 0,
    fri = 1,
    mul = .2
  },
  -- 1 floating up
  {
    spd = { -.1, .1, -.3, -.1 },
    gra = -.005,
    fri = 1.001,
    mul = .6
  },
  -- 2 floating down
  {
    spd = { -.5, .5, -.4, -.7 },
    gra = .02,
    fri = .999,
    mul = .7
  },
  -- 3 exploding
  {
    spd = { -.3, .3, -.1, -.2 },
    gra = 0.02,
    fri = .98,
    mul = .9
  },
  -- 4 exploding harder (override 1)
  {
    spd = { -1.2, 1.2, -1.6, .2 },
    gra = 0.05,
    fri = .99,
    mul = 1
  },
  -- 5 small projectile (override 2)
  {
    spd = { 0, 0, 0, 0 },
    gra = 0.002,
    fri = 1,
    mul = 1.2
  },
  -- 6 medium projectile (override 3)
  {
    spd = { -.2, .2, -.2, .2 },
    gra = 0.02,
    fri = .985,
    mul = 1
  }
}

-------------------------------- EMITTER PROPS ---------------------------
-- 3 bit 8 possible bursts
e_bursts = { [0] = 1, 2, 3, 5, 7, 9, 13, 21 }

-- 2 bit 4 possible spread
e_spreads = { [0] = 0, 2, 5, 9 }

-- 3 bits 8 possible cones
e_cones = { [0] = 0, .001, .01, .02, .1, .25, .15, .2 }

-- 2 bit 4 possible delay
e_delays = {
  [0] = { 0, 0 },
  [1] = { 3, 6 },
  [2] = { 6, 12 },
  [3] = { 12, 24 }
}

function smoker(_ENV)
  if rnd() < .1 then
    emit(pos, smoke_p, 0, spd * -1)
  end
  return eol
end

function end_smoker(_ENV)
  if eol then
    smoke(pos)
  end
  return eol
end

function burner(_ENV)
  if get_px(n_pos.x, n_pos.y) ~= 1 and rnd() < .5 then
    smoke(pos)
    set_px(n_pos.x, n_pos.y, rnd() < .1 and 1 or 0)
    return true
  end
  return eol
end

function painter(_ENV)
  if n_pos.y < 120 and (get_px(n_pos.x, n_pos.y) ~= 1 and rnd() < .3) then
    set_px(n_pos.x, n_pos.y, rnd(colors))
    return true
  end
  return eol
end

function bouncer(_ENV)
  local pts = p_between(pos, n_pos)
  if #pts > 1 then
    for i = 2, #pts do
      local p = pts[i]
      if get_px(p.x, p.y) ~= 1 then
        local prev = pts[i - 1]
        local d = p - prev
        if d.x ~= 0 then
          if d.y ~= 0 then
            if get_px(p.x + (d.x < 0 and 1 or -1), p.y) == 1 then
              spd.x *= -.9
            elseif get_px(p.x, p.y + (d.y < 0 and 1 or -1)) == 1 then
              spd.y *= -.9
            else
              spd = (spd * -.9):rot(rand(-.01, .01))
            end
          else
            spd.x *= -.9
          end
        else
          spd.y *= -.9
        end
        n_pos = prev
        break
      end
    end
  end
  return eol
end

-- 3 bit 8 possible update functions
e_upd_fns = {
  [0] = nil, -- 0 no update
  { smoker }, -- 1 smoke
  { smoker, end_smoker }, -- 2 smoke + end smoke
  { burner }, -- 3 fire
  { painter }, -- 4 paint
  { bouncer } -- 5 bounce
}
