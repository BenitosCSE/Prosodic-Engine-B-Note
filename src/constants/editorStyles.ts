export interface ModernStyle {
  name: string;
  class: string;
  style?: string;
}

export const MODERN_STYLES: ModernStyle[] = [
  // NEON & GLOW
  { name: 'Neon Orange', class: 'style-neon-orange', style: 'color: #ff6b00; text-shadow: 0 0 5px #ff6b00, 0 0 10px #ff6b00;' },
  { name: 'Neon Blue', class: 'style-neon-blue', style: 'color: #00f2ff; text-shadow: 0 0 5px #00f2ff, 0 0 10px #00f2ff;' },
  { name: 'Neon Pink', class: 'style-neon-pink', style: 'color: #ff00ff; text-shadow: 0 0 5px #ff00ff, 0 0 10px #ff00ff;' },
  { name: 'Neon Green', class: 'style-neon-green', style: 'color: #00ff41; text-shadow: 0 0 5px #00ff41, 0 0 10px #00ff41;' },
  { name: 'Neon Purple', class: 'style-neon-purple', style: 'color: #bc13fe; text-shadow: 0 0 5px #bc13fe, 0 0 10px #bc13fe;' },
  
  // GRADIENTS
  { name: 'Sunset', class: 'style-sunset', style: 'background: linear-gradient(to right, #ff512f, #dd2476); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Ocean', class: 'style-ocean', style: 'background: linear-gradient(to right, #2193b0, #6dd5ed); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Forest', class: 'style-forest', style: 'background: linear-gradient(to right, #11998e, #38ef7d); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Royal', class: 'style-royal', style: 'background: linear-gradient(to right, #141e30, #243b55); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Lush', class: 'style-lush', style: 'background: linear-gradient(to right, #56ab2f, #a8e063); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Fire', class: 'style-fire', style: 'background: linear-gradient(to right, #f12711, #f5af19); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Frost', class: 'style-frost', style: 'background: linear-gradient(to right, #00c6ff, #0072ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Mauve', class: 'style-mauve', style: 'background: linear-gradient(to right, #42275a, #734b6d); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Deep Sea', class: 'style-deep-sea', style: 'background: linear-gradient(to right, #2c3e50, #4ca1af); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Peach', class: 'style-peach', style: 'background: linear-gradient(to right, #ed4264, #ffedbc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  
  // LUXURY & METALLIC
  { name: 'Gold', class: 'style-gold', style: 'background: linear-gradient(to bottom, #bf953f, #fcf6ba, #b38728, #fcf6ba, #aa771c); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Silver', class: 'style-silver', style: 'background: linear-gradient(to bottom, #cfd8dc, #90a4ae, #cfd8dc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Bronze', class: 'style-bronze', style: 'background: linear-gradient(to bottom, #804a00, #ff9e00, #804a00); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Platinum', class: 'style-platinum', style: 'background: linear-gradient(to bottom, #e5e4e2, #ffffff, #e5e4e2); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Rose Gold', class: 'style-rose-gold', style: 'background: linear-gradient(to bottom, #b76e79, #f7cac9, #b76e79); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },

  // MODERN & MINIMAL
  { name: 'Glass', class: 'style-glass', style: 'color: rgba(255, 255, 255, 0.8); text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);' },
  { name: 'Soft Shadow', class: 'style-soft-shadow', style: 'text-shadow: 2px 2px 4px rgba(0,0,0,0.5);' },
  { name: 'Deep Shadow', class: 'style-deep-shadow', style: 'text-shadow: 4px 4px 8px rgba(0,0,0,0.8);' },
  { name: 'Outline', class: 'style-outline', style: '-webkit-text-stroke: 1px #ff6b00; color: transparent;' },
  { name: 'Blurry', class: 'style-blurry', style: 'color: transparent; text-shadow: 0 0 5px rgba(255,107,0,0.5);' },

  // RETRO & VINTAGE
  { name: 'Retro Red', class: 'style-retro-red', style: 'color: #ff4e50; text-shadow: 2px 2px 0px #f9d423;' },
  { name: '80s Synth', class: 'style-80s', style: 'color: #f0f; text-shadow: 3px 3px 0px #0ff;' },
  { name: 'Vintage Paper', class: 'style-vintage', style: 'color: #5d4037; font-family: serif;' },
  { name: 'Old Computer', class: 'style-old-pc', style: 'color: #33ff33; font-family: monospace; text-shadow: 0 0 5px #33ff33;' },
  { name: 'Sepia', class: 'style-sepia', style: 'color: #704214;' },

  // BOLD & GRAPHIC
  { name: 'Zebra', class: 'style-zebra', style: 'background: repeating-linear-gradient(45deg, #000, #000 10px, #fff 10px, #fff 20px); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Checker', class: 'style-checker', style: 'background-image: radial-gradient(#ff6b00 20%, transparent 20%), radial-gradient(#ff6b00 20%, transparent 20%); background-position: 0 0, 10px 10px; background-size: 20px 20px; -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Holographic', class: 'style-holographic', style: 'background: linear-gradient(135deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Rainbow', class: 'style-rainbow', style: 'background: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Candy', class: 'style-candy', style: 'background: linear-gradient(to right, #ff9a9e 0%, #fecfef 99%, #fecfef 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },

  // DARK & MOODY
  { name: 'Ghostly', class: 'style-ghostly', style: 'opacity: 0.3; filter: blur(1px);' },
  { name: 'Blood', class: 'style-blood', style: 'color: #8a0303; text-shadow: 0 0 5px #ff0000;' },
  { name: 'Obsidian', class: 'style-obsidian', style: 'color: #1a1a1a; text-shadow: 0 0 2px #fff;' },
  { name: 'Midnight', class: 'style-midnight', style: 'color: #2c3e50; text-shadow: 0 0 10px #34495e;' },
  { name: 'Void', class: 'style-void', style: 'color: #000; text-shadow: 0 0 8px rgba(255,255,255,0.2);' },

  // VIBRANT
  { name: 'Electric', class: 'style-electric', style: 'color: #ffff00; text-shadow: 0 0 10px #ffff00;' },
  { name: 'Toxic', class: 'style-toxic', style: 'color: #adff2f; text-shadow: 0 0 10px #00ff00;' },
  { name: 'Plasma', class: 'style-plasma', style: 'background: radial-gradient(circle, #ff00ff, #00ffff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Cyberpunk', class: 'style-cyberpunk', style: 'color: #f3ec78; background-image: linear-gradient(45deg, #f3ec78, #af4261); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' },
  { name: 'Ultraviolet', class: 'style-ultraviolet', style: 'color: #6a0dad; text-shadow: 0 0 15px #bc13fe;' },

  // SOFT & CALM
  { name: 'Cloud', class: 'style-cloud', style: 'color: #ecf0f1; text-shadow: 0 0 5px #fff;' },
  { name: 'Lavender', class: 'style-lavender', style: 'color: #e6e6fa;' },
  { name: 'Mint', class: 'style-mint', style: 'color: #98ff98;' },
  { name: 'Sky', class: 'style-sky', style: 'color: #87ceeb;' },
  { name: 'Sand', class: 'style-sand', style: 'color: #c2b280;' }
];
