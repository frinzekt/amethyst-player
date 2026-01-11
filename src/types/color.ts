import palettes from "./palettes";

export enum ColorType
{
  Palette, //[Palette name, Palette ID]
  RGB, //[R, G, B]
  RGBA, //[R, G, B, A]
}

export class Color
{
  type?: ColorType;
  value?: number[];

  constructor(type: ColorType, value ?: any[])
  {
    this.type = type;
    this.value = value;
  }

  rgb(): [number, number, number]
  {
    var rgb: [number, number, number] = [0, 0, 0];
    if(this.type === undefined || this.value === undefined)
    {
      //Just keep r g b as 0, 0, 0
    }
    else if(this.type === ColorType.Palette)
    {
      if(palettes[this.value[0]] === undefined)
        return [0, 0, 0];
      rgb = palettes[this.value[0]][this.value[1]];
    }
    else if(this.type === ColorType.RGB)
    {
      rgb[0] = this.value[0];
      rgb[1] = this.value[1];
      rgb[2] = this.value[2];
    }

    return rgb;
  }

  rgb_str(): string
  {
    if(this.type === ColorType.Palette)
    {
      var [r, g, b] = this.rgb();
      
      return `rgb(${r}, ${g}, ${b})`;
    }
    else if(this.type === ColorType.RGB)
    {
      return `rgb(${this.value[0]}, ${this.value[1]}, ${this.value[2]})`;
    }
    else if(this.type === ColorType.RGBA)
    { 
      return `rgba(${this.value[0]}, ${this.value[1]}, ${this.value[2]}, ${this.value[3]})`;
    }
  }

  overlay(base: Color): Color
  {
    var self_rgb = this.rgb();
    var base_rgb = base.rgb();

    var rgb = [
      base_rgb[0] + (255 - base_rgb[0]) * (self_rgb[0] / 255),
      base_rgb[1] + (255 - base_rgb[1]) * (self_rgb[1] / 255),
      base_rgb[2] + (255 - base_rgb[2]) * (self_rgb[2] / 255)
    ];

    return new Color(ColorType.RGB, rgb);
  }

  rgba(): Color
  {
    //convert to HSV
    var self_rgb = this.rgb();
    var hsv = this.rgb2hsv(self_rgb[0], self_rgb[1], self_rgb[2]);

    // convert hsv to rgb
    var rgba = this.hsv2rgb(hsv[0], hsv[1], 1.0);
    rgba.push(hsv[2]);
    
    return new Color(ColorType.RGBA, rgba);
  }

  palette(): string|undefined
  {
    if(this.type === ColorType.Palette)
    {
      return this.value?.[0];
    }
    return undefined;
  }

  index(): number|undefined
  {
    if(this.type === ColorType.Palette)
    {
      return this.value?.[1];
    }
    return undefined;
  }

  isBlack(): boolean
  {
    let [r, g, b] = this.rgb();

    return !(r || g || b)
  }

  rgb2hsv (r, g, b): [number, number, number] {
    let rabs, gabs, babs, rr, gg, bb, h, s, v, diff, diffc, percentRoundFn;
    rabs = r / 255;
    gabs = g / 255;
    babs = b / 255;
    v = Math.max(rabs, gabs, babs),
    diff = v - Math.min(rabs, gabs, babs);
    diffc = c => (v - c) / 6 / diff + 1 / 2;
    if (diff == 0) {
        h = s = 0;
    } else {
        s = diff / v;
        rr = diffc(rabs);
        gg = diffc(gabs);
        bb = diffc(babs);

        if (rabs === v) {
            h = bb - gg;
        } else if (gabs === v) {
            h = (1 / 3) + rr - bb;
        } else if (babs === v) {
            h = (2 / 3) + gg - rr;
        }
        if (h < 0) {
            h += 1;
        }else if (h > 1) {
            h -= 1;
        }
    }
    return [h, s, v];
  }

   hsv2rgb(h, s, v) : [number, number, number] {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
}