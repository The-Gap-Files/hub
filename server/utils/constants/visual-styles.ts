
export interface VisualStyle {
  id: string;
  name: string;
  description: string;
  tags: string;
}

export const VISUAL_STYLES: VisualStyle[] = [
  {
    id: 'epictok',
    name: 'Epictok Imersivo',
    description: 'Estilo de ilustração 2D vintage, tipo Studio Ghibli e Eyvind Earle.',
    tags: 'digital 2D illustration, flat cell shading, inked outlines, vintage poster aesthetic, ligne claire style, Studio Ghibli background art, Eyvind Earle style, fantasy adventure concept art, classic RPG illustration, matte painting, textured paper effect, low detail faces, high contrast lighting, muted colors, earthy palette, desaturated tones, sepia undertones, dramatic sky lighting, backlit clouds, golden hour'
  },
  {
    id: 'gta6',
    name: 'Estilo GTA VI',
    description: 'Cores vibrantes, estética de Vice City com iluminação de pôr do sol.',
    tags: 'GTA 6 style, vibrant saturated colors, vice city sunset lighting, detailed urban environment, cinematic lens flare, high contrast, digital illustration, modern realistic graphics, neon highlights'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Futurista',
    description: 'Luzes neon, cidades futuristas e tecnologia avançada.',
    tags: 'cyberpunk aesthetic, neon city lights, rainy streets, futuristic technology, synthwave color palette, volumetric lighting, high tech low life, blade runner style'
  },
  {
    id: 'oil-painting',
    name: 'Pintura a Óleo',
    description: 'Estilo clássico de quadros antigos e museus.',
    tags: 'classical oil painting style, Renaissance art, visible brushstrokes, canvas texture, rich pigments, historical museum quality, Baroque influence'
  },
  {
    id: 'photorealistic',
    name: 'Fotorrealista',
    description: 'Imagens que parecem fotografias reais.',
    tags: 'photorealistic, 35mm photography, sharp focus, natural lighting, ultra-detailed, cinematic film still, Sony A7R IV, high resolution, raw photo'
  }
];

export const getStyleTags = (styleId: string): string => {
  const style = VISUAL_STYLES.find(s => s.id === styleId);
  return style ? style.tags : '';
};
