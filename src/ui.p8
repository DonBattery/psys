pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
function draw_arrow(x, y, col)
  local function one_arrow(x, y, col)
    line(x, y, x + 3, y, col)
    line(x, y, x, y + 3, col)
    line(x, y, x + 4, y + 4, col)
  end
  for p in all({
    { 1, 0, 0 },
    { 0, 1, 0 },
    { 1, 1, 0 },
    { 0, 0, col }
  }) do
    one_arrow(x + p[1], y + p[2], p[3])
  end
end

function round_box(x, y, w, col)
  rectfill(x + 1, y, x + w - 2, y + 7, col)
  rectfill(x, y + 1, x + w - 1, y + 6, col)
end

function point_in_elem(x, y, e)
  return x >= e.x - e.w * e.o and x < e.x - e.w * e.o + e.w and y >= e.y and y < e.y + 8
end

function index_of(list, e)
  for i, v in ipairs(list) do
    if (v == e) return i
  end
end

function tags_match(e, tags)
  if (not e.tags) return false
  for tag in all(tags) do
    if (not index_of(e.tags, tag)) return false
  end
  return true
end

function new_ui(_left_col, _right_col, _static)
  poke(0x5f2d, 0x1)

  local mouse_button = function(id)
    return setmetatable(
      {
        update = function(_ENV)
          isdown = band(stat(34), id) == id
          clicked = isdown and not wasdown
          released = not isdown and wasdown
          hold = isdown and wasdown
          wasdown = isdown
        end
      }, _env
    )
  end

  local ui = {
    left_col = _left_col or {},
    right_col = _right_col or {},
    static = _static or {},

    input_elem = nil,
    hoovered_elem = nil,
    clicked_elem = nil,

    lmbtn = mouse_button(1),
    rmbtn = mouse_button(2),
    wheel = 0,
    wheelup = false,
    wheeldown = false,


    swap_col = function(_ENV)
      left_col, right_col = right_col, left_col
    end,

    all_elems = function(_ENV)
      local co = cocreate(function()
        for i, col in ipairs({ left_col, right_col, static }) do
          for j, elem in ipairs(col) do
            if elem.row then
              local prev = nil
              for k, sub_elem in ipairs(elem.row) do
                yield({ sub_elem, prev, i - 1, k == #elem.row })
                prev = sub_elem
              end
            else
              yield({ elem, nil, i - 1, true })
            end
          end
        end
      end)

      return function()
        local status, res = coresume(co)
        if status and res then
          return unpack(res)
        else
          return nil
        end
      end
    end,

    get = function(_ENV, tags)
      local l, t = {}, type(tags) == "string" and { tags } or tags
      for e in all_elems(_ENV) do
        if (not t or tags_match(e, t)) add(l, e)
      end
      return l
    end,

    first = function(_ENV, tags)
      return get(_ENV, tags)[1]
    end,

    set = function(_ENV, props, tags)
      for e in all(get(_ENV, tags)) do
        for k, v in pairs(props) do
          e[k] = v
        end
      end
    end,


    render_elem = function(_ENV, x, y, o, e)
      if not e.text then return end
      local tx = e.text .. (e.input and (":" .. e.buffer .. (e == input_elem and "_" or "")) or "")
      e.x, e.y, e.o, e.w = x, y, o, print(tx, 0, 128) + 3
      x = x - e.w * e.o

      local hoover, click = e == hoovered_elem, e == clicked_elem
      local ox, oy, w = (hoover or click) and -1 or 0, click and 1 or 0, e.w

      -- Color mapping:
      -- text_highlight_color = 10
      -- box_color = 4
      -- box_shadow_color = 5
      -- text_color = 15
      -- hoovered_box_color = 9
      -- hoovered_box_shadow_color = 6
      -- hoovered_text_color = 13
      -- hoovered_text_shadow_color = 7
      -- clicked_box_color = 10
      -- clicked_text_color = 14
      -- clicked_text_shadow_color = 7
      -- mouse_color = 3
      -- hoovering_mouse_color = 11
      -- clicking_mouse_color = 7
      -- draw shadow (if not clicked)
      if not click then
        round_box(x + ox, y + 1 + oy, w, hoover and 6 or 5)
      end

      -- draw main box
      round_box(x + ox, y + oy, w, click and 10 or hoover and 9 or 4)

      -- draw text
      print(tx, x + ox + 2, y + oy + 1, e.highlighted and 10 or click and 14 or hoover and 13 or 15)

      if (e.on_draw) e:on_draw(ox, oy)
    end,

    draw = function(_ENV, mouse_type)
      mouse_x, mouse_y, wheel = stat(32), stat(33), stat(36)
      mpos = v2(mouse_x, mouse_y)
      if input_elem then
        local buff, enter = input_elem.buffer or ""
        while stat(30) do
          local c = stat(31)
          if c == "\r" then
            poke(0x5f30, 1)
            enter = true
            break
          end
          buff = c == "\b" and sub(buff, 1, #buff - 1) or #buff < 12 and buff .. c or buff
        end
        input_elem.buffer = buff
        if enter then
          if input_elem.on_enter then input_elem:on_enter() end
          input_elem = nil
        end
      end

      lmbtn:update()
      rmbtn:update()
      mpos, wheelup, wheeldown = v2(mouse_x, mouse_y), wheel == 1, wheel == -1

      -- unhoover
      if hoovered_elem and not point_in_elem(mouse_x, mouse_y, hoovered_elem) then
        hoovered_elem = nil
      end

      -- click
      if lmbtn.clicked and hoovered_elem then
        clicked_elem = hoovered_elem
        if clicked_elem.input then
          while stat(30) do
            stat(31)
          end
          input_elem = clicked_elem
        else
          input_elem = nil
        end
        if (clicked_elem.on_click) clicked_elem:on_click()
      end

      -- unclick
      if lmbtn.released and clicked_elem then
        clicked_elem = nil
      end

      local l_y, r_y = left_col.y or 1, right_col.y or 1
      for e, prev, i, end_of_row in all_elems(_ENV) do
        if not e.hide then
          if e.on_update then e:on_update() end

          -- hoover
          if e.text and e.on_click and e.w and point_in_elem(mouse_x, mouse_y, e) then
            hoovered_elem = e
          end

          -- render
          if i == 0 then
            render_elem(_ENV, prev and prev.x + prev.w + 2 or (left_col.x and left_col.x or 1), l_y, i, e)
            if end_of_row then l_y += 10 end
          elseif i == 1 then
            render_elem(_ENV, prev and prev.x - prev.w - 2 or (right_col.x and right_col.x or 127), r_y, i, e)
            if end_of_row then r_y += 10 end
          else
            render_elem(_ENV, e.x, e.y, e.orientation == "left" and 1 or 0, e)
          end
        end
      end

      -- draw mouse
      local m_col = clicked_elem and 7 or hoovered_elem and 11 or 3

      if mouse_type == "arrow" then
        draw_arrow(mouse_x, mouse_y, m_col)
      elseif mouse_type == "lines" then
        line(mouse_x, 0, mouse_x, 127, m_col)
        line(0, mouse_y, 127, mouse_y, m_col)
      else
        pset(mouse_x, mouse_y, m_col)
      end
    end
  }

  return setmetatable(ui, _env)
end

function new_base_elem(text, tags, on_click, on_update, on_draw)
  return {
    text = text,
    tags = type(tags) == "string" and { tags } or tags,
    on_click = on_click,
    on_update = on_update,
    on_draw = on_draw
  }
end

function new_setter(var, default, amount, tags, on_click, on_update, on_draw)
  _g[var] = _g[var] or default
  return {
    row = {
      new_base_elem(
        "+", tags, function(self)
          _g[var] += amount
          if (on_click) on_click(self)
        end, on_update, on_draw
      ),
      new_base_elem(
        "-", tags, function(self)
          _g[var] -= amount
          if (on_click) on_click(self)
        end, on_update, on_draw
      ),
      new_base_elem(
        "reset", tags, function(self)
          _g[var] = default
          if (on_click) on_click(self)
        end, function(self)
          self.text = var .. ": " .. _g[var]
          if (on_update) on_update(self)
        end, on_draw
      )
    }
  }
end

function new_color_picker(var, tags, on_click, on_update, on_draw)
  _g[var] = _g[var] or 0
  return new_base_elem(
    var, tags,
    function(self)
      _g[var] = (_g[var] + 1) % 16
      if (on_click) on_click(self)
    end,
    on_update,
    function(self, ox, oy)
      local x, y = self.x - self.o * 10 + ox + (self.o == 0 and self.w - 10 or 0), self.y + oy
      rect(x, y, x + 8, y + 7, _g[var] ~= 4 and 4 or 5)
      rectfill(x + 1, y + 1, x + 7, y + 6, _g[var])
      if (on_draw) on_draw(self)
    end
  )
end

function new_looper(var, values, tags, on_click, on_update, on_draw)
  _g[var] = _g[var] or values[1]
  local index = 1
  return new_base_elem(
    var, tags,
    function(self)
      index += 1
      if index > #values then
        index = 1
      end
      _g[var] = values[index]
      if (on_click) on_click(self)
    end,
    function(self)
      self.text = var .. ": " .. tostr(values[index])
      if (on_update) on_update(self)
    end,
    on_draw
  )
end

function new_selector(var, tbl, tags, on_click, on_update, on_draw)
  _g[var] = _g[tbl][1]
  local index = 1
  return new_base_elem(
    var, tags,
    function(self)
      local values = _g[tbl]
      index += 1
      if index > #values then
        index = 1
      end
      _g[var] = values[index]
      if (on_click) on_click(self)
    end,
    function(self)
      self.text = var .. ":" .. _g[var]
      if (on_update) on_update(self)
    end,
    on_draw
  )
end
