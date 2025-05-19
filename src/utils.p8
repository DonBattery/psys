pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
_g = _ENV

_env = { __index = _ENV }

function env(obj)
  return setmetatable(obj, _env)
end

function cycle_idx(idx, n, delta)
  if type(n) == "table" then
    n = #n
  end
  idx = idx + delta
  if idx < 1 then
    idx = n
  elseif idx > n then
    idx = 1
  end
  return idx
end

-- random numbers
function rand(l, h) return rnd(abs(h - l)) + min(l, h) end
function randint(l, h) return flr(rnd(abs(h + 1 - l))) + min(l, h) end

function pprint(s, x, y, c1, c2, ind, out)
  x -= ind == "r" and print(s, 0, 128) or ind == "c" and print(s, 0, 128) / 2 or 0
  if out then
    for ox = -1, 1 do
      for oy = -1, 1 do
        if (ox | oy != 0) print(s, x + ox, y + oy, c2)
      end
    end
  end
  print(s, x, y, c1)
end

-- 2d vector class (callable)
v2 = {}
v2.__index = v2
setmetatable(
  v2, {
    __call = function(cls, x, y)
      return setmetatable({ x = x or 0, y = y or 0 }, cls)
    end
  }
)
function v2:__add(o) return v2(self.x + o.x, self.y + o.y) end
function v2:__sub(o) return v2(self.x - o.x, self.y - o.y) end
function v2:__mul(s) return v2(self.x * s, self.y * s) end
function v2:__div(s) return v2(self.x / s, self.y / s) end
function v2:__len() return sqrt(self.x ^ 2 + self.y ^ 2) end
function v2:clone() return v2(self.x, self.y) end
function v2:norm() local m = #self return m > 0 and self / m or v2() end
function v2:rnd() return v2(1, 0):rot(rnd()) end
function v2:rand(lx, hx, ly, hy) return v2(rand(lx, hx), rand(ly, hy)) end
function v2:randint(lx, hx, ly, hy) return v2(flr(rnd(hx - lx + 1)) + lx, flr(rnd(hy - ly + 1)) + ly) end
function v2:flr() return v2(flr(self.x), flr(self.y)) end
function v2:sqrdist(o) return (o.x - self.x) ^ 2 + (o.y - self.y) ^ 2 end
function v2:limit(limit) self.x, self.y = mid(-limit, self.x, limit), mid(-limit, self.y, limit) end
function v2:rot(a) local c, s = cos(a), sin(a) return v2(self.x * c - self.y * s, self.x * s + self.y * c) end

function p_between(p1, p2)
  local points, x1, y1, x2, y2 = {}, flr(p1.x), flr(p1.y), flr(p2.x), flr(p2.y)
  local dx, dy, sx, sy = abs(x2 - x1), abs(y2 - y1), x1 < x2 and 1 or -1, y1 < y2 and 1 or -1
  local err = dx - dy
  while true do
    add(points, v2(x1, y1))
    if x1 == x2 and y1 == y2 then break end
    local e2 = 2 * err
    if e2 > -dy then
      err, x1 = err - dy, x1 + sx
    end
    if e2 < dx then
      err, y1 = err + dx, y1 + sy
    end
  end
  return points
end

function p_coll(p, r)
  return p.x < r.pos.x + r.size.x
      and p.x >= r.pos.x
      and p.y < r.pos.y + r.size.y
      and p.y >= r.pos.y
end

function r_coll(a, b)
  return a.pos.x < b.pos.x + b.size.x
      and a.pos.x + a.size.x > b.pos.x
      and a.pos.y < b.pos.y + b.size.y
      and a.pos.y + a.size.y > b.pos.y
end

function init_destructors()
  destructors = {}
  for r = 0, 10 do
    cls()
    circfill(r, r, r, 1)
    local d = {}
    for x = 0, 2 * r + 1 do
      for y = 0, 2 * r + 1 do
        if pget(x, y) == 1 then add(d, { x = x - r, y = y - r }) end
      end
    end
    add(destructors, d)
  end
  cls()
  pprint("chaos emerges,", 24, 26, 11, 0, "l", true)
  pprint("last war approaches", 28, 35, 11, 0, "l", true)
end
function destruct(pos, dir, l)
  for i = 1, #l do
    local s, str = l[i][1], l[i][2]
    if s % 2 == 0 then pos += v2:randint(-1, 1, -1, 1) end
    local m, pc = str - .5, s <= 3 and 1 or 1 / (s - 3.9)
    for p in all(destructors[s]) do
      local x, y = pos.x + p.x, pos.y + p.y
      local pp = v2(x, y)
      local c, r, d = get_px(x, y), 1, pos:sqrdist(pp)
      if c ~= 1 and c < 16 then
        if rnd() < .5 + m then
          if (rnd() < pc) dirt(pp, 0, dir, (d / 8) * str, { colors = { c } })
        else
          r = 0
        end
        set_px(x, y, r)
      end
    end
  end
end

-- map
_y = {}
for y = 8, 119 do
  _y[y] = y * 64
end
function get_px(x, y)
  if x < 0 or x >= 128 or y < 8 then return 16 end
  if y >= 120 then return 17 end
  x, y = flr(x), flr(y)
  local byte_val = peek(0x8000 + _y[y] + flr(x / 2))
  if x % 2 == 0 then
    return byte_val & 0x0f
  end
  return (byte_val >> 4) & 0x0f
end
function set_px(x, y, col)
  if x < 0 or x >= 128 or y < 8 or y >= 120 then return end
  x, y = flr(x), flr(y)
  local addr = 0x8000 + _y[y] + flr(x / 2)
  local byte_val = peek(addr)
  if x % 2 == 0 then
    byte_val = (byte_val & 0xf0) | (col & 0x0f)
  else
    byte_val = (byte_val & 0x0f) | ((col & 0x0f) << 4)
  end
  poke(addr, byte_val)
end
function free_rect(pos, size)
  for x = pos.x, pos.x + size.x - 1 do
    for y = pos.y, pos.y + size.y - 1 do
      if (get_px(x, y) ~= 1) return false
    end
  end
  return true
end
function gen_map(density, color1, color2, left_closed, right_closed, top_closed, bottom_closed)
  local map, tmp = {}, {}
  for x = 0, 131 do
    map[x], tmp[x] = {}, {}
    for y = 0, 115 do
      map[x][y] = ((x < 2 and left_closed or x > 129 and right_closed or y < 2 and top_closed or y > 112 and bottom_closed or rnd() < density) and 1 or 0)
      tmp[x][y] = map[x][y]
    end
  end
  for _ = 1, 3 do
    for x = 2, 129 do
      for y = 2, 113 do
        local n = 0
        for dx = -2, 2 do
          for dy = -2, 2 do
            n += (dx ~= 0 or dy ~= 0) and map[x + dx][y + dy] or 0
          end
        end
        tmp[x][y] = n > 12 and 1 or 0
      end
    end
    map, tmp = tmp, map
  end
  for y = 0, 111 do
    for x = 0, 126, 2 do
      local col = { 1, 1 }
      for p = 0, 1 do
        if map[x + p + 2][y + 2] == 1 then
          local ch = .13
          for off = 1, 3 do
            if y > 2 and map[x + p + 2][y + 2 - off] == 0 then
              ch += (.58 / (off + 1))
            end
          end
          col[p + 1] = rnd() < ch and color2 or color1
        end
      end
      poke(0x8000 + _y[y + 8] + (x >> 1), (col[2] << 4) | col[1])
    end
  end
end

function joy(pid)
  local j = env({
    upd = function(_ENV)
      local _l, _r, _u, _d = l:upd(), r:upd(), u:upd(), d:upd()
      x:upd()
      o:upd()
      dir = ((_u and not _d and "n") or (_d and not _u and "s") or "") .. ((_l and not _r and "w") or (_r and not _l and "e") or "")
    end
  })
  for i, b in ipairs(split("l,r,u,d,o,x")) do
    j[b] = env({
      _p = pid,
      _b = i - 1,
      upd = function(_ENV)
        down = btn(_b, _p)
        press, release, hold = down and not prev, not down and prev, (down and prev) and hold + 1 or 0
        prev = down
        return down
      end
    })
  end
  return j
end

-- 16-bit particle encoders
function encode_particle(opts)
  -- bits  0–2: kind (3 bits)
  --       3–5: life (3 bits)
  --       6–9: size (4 bits)
  --      10–13: color (4 bits)
  --      14–15: physics (2 bits)
  local k = band(opts.kind, 0x7)
  local l = band(opts.life, 0x7) << 3
  local s = band(opts.size, 0xF) << 6
  local c = band(opts.color, 0xF) << 10
  local p = band(opts.phy, 0x3) << 14
  return k | l | s | c | p
end

-- NEW
-- bits    0–2:   burst      (3 bits)
--        3–4:   spread     (2 bits)
--        5–7:   cone       (3 bits)
--        8–9:   delay      (2 bits)
--      10–13:  on_upd      (4 bits)
--      14–15:  physics ov. (2 bits)
function encode_emitter(opts)
  local b = (opts.burst or 0) & 0x7
  local sp = ((opts.spread or 0) & 0x3) << 3
  local co = ((opts.cone or 0) & 0x7) << 5
  local d = ((opts.delay or 0) & 0x3) << 8
  local u = ((opts.on_upd or 0) & 0xF) << 10
  local phy = ((opts.phy or 0) & 0x3) << 14
  return b | sp | co | d | u | phy
end

-- update a single particle
function upd_part(_ENV)
  if delay > 0 then
    delay -= 1
  else
    life += 1
    eol, acc, n_pos = life > max_life or (pos.x < 0 or pos.x > 127 or pos.y < 0 or pos.y > 127), v2(0, gra), pos + spd
    for upd in all(on_upd) do
      upd(_ENV)
    end
    spd = (spd + acc) * fri
    pos = n_pos
  end
  return eol
end

-- particle system
function p_sys()
  return env({
    pts = {},
    upd = function(_ENV)
      local i, l = 1, #pts
      while i <= l do
        if pts[i]:upd() then
          pts[i] = pts[l]
          deli(pts, l)
          l -= 1
        end
        i += 1
      end
    end,

    draw = function(_ENV)
      for p in all(pts) do
        if p.delay < 1 then
          local k, x, y, t = p.kind, p.pos.x, p.pos.y, p.life / p.max_life
          local s, c = p.sizes[min(flr(t * p.num_s) + 1, p.num_s)], p.colors[min(flr(t * p.num_c) + 1, p.num_c)]
          if k == 0 then
            pset(x, y, c)
          elseif k == 1 then
            circ(x, y, s, c)
          elseif k == 2 then
            circfill(x, y, s, c)
          elseif k == 3 then
            local h = s / 2
            rect(x - h, y - h, x + h, y + h, c)
          elseif k == 4 then
            local d = p.spd:norm() * -s
            line(x, y, x + d.x, y + d.y, c)
          elseif k == 5 then
            circ(x, y, 1, p.colors[2])
            pset(x, y, p.colors[1])
          elseif k == 6 then
            local d = p.spd:norm() * -s
            line(x, y, x + d.x, y + d.y, p.colors[1])
            pset(x + d.x, y + d.y, p.colors[2])
          else
            local dir = p.pos - (p.spd:norm():rot(p.life / 50) * -3)
            line(x, y, dir.x, dir.y, p.colors[2])
            pset(x, y, p.colors[1])
          end
        end
      end
    end
  })
end

function emit(pos, particle, effect, dir, force, opts)
  effect, dir = effect or 0, (dir and dir:norm() or v2()) * (force and force or 1)

  -- decode emitter bits
  -- 2-bit physics override
  local poi = (effect >> 14) & 0x3
  local spread = e_spreads[(effect >> 3) & 0x3]
  local cone = e_cones[(effect >> 5) & 0x7]
  local pp = phy_params[poi > 0 and 3 + poi or (particle >> 14) & 0x3]

  -- assemble options
  local o = {
    kinds = p_kinds[particle & 0x7],
    lifes = p_lifes[(particle >> 3) & 0x7],
    sizes = p_sizes[(particle >> 6) & 0xF],
    colors = p_colors[(particle >> 10) & 0xF],
    delays = e_delays[(effect >> 8) & 0x3],
    on_upd = e_upd_fns[(effect >> 10) & 0xF]
  }
  for k, v in pairs(opts) do
    o[k] = v
  end

  -- spawn loop
  for i = 1, e_bursts[effect & 0x7] do
    add(
      (rnd() < .5 and fg_part or bg_part).pts,
      env({
        life = 0,
        max_life = randint(o.lifes[1], o.lifes[2]),
        delay = randint(o.delays[1], o.delays[2]),
        kind = rnd(o.kinds),
        pos = pos + (spread > 0 and v2:rnd() * rand(0, spread) or v2()),
        spd = (dir * pp.mul + v2:rand(pp.spd[1], pp.spd[2], pp.spd[3], pp.spd[4])):rot(rand(-cone, cone)),
        gra = pp.gra,
        fri = pp.fri,
        mul = pp.mul,
        colors = o.colors,
        num_c = #o.colors,
        sizes = o.sizes,
        num_s = #o.sizes,
        on_upd = o.on_upd,
        upd = upd_part
      })
    )
  end
end

function magic(pos, dir, opts)
  for i = 1, #opts, 2 do
    emit(pos, opts[i], opts[i + 1], dir)
  end
end
