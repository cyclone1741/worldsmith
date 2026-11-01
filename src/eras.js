// Era × land cards. The civilization genome's initial values come from here.
// Colors are the "painted diorama" palettes from the art direction.
export const ERAS = {
  rome: {
    name: '로마 · 80년', tech: 3,
    palette: { wall: ['#E8DCC4', '#F3EBDA', '#D9CBAA'], roof: ['#B9573C', '#A64E36', '#C9654A'], accent: ['#2F6F8F', '#6B7A3F'], trim: '#CFC2A3', ground: '#8FA35A' },
    roofs: ['hip', 'dome', 'flat'], footprints: ['rect', 'rect', 'L', 'circle', 'polygon'],
    columns: 0.6, arches: 0.5, towers: 0.15, eave: 0.12, flare: 1.04, tiers: 0,
    materials: ['석회석', '대리석', '벽돌', '나무'], locked: ['철', '유리', '콘크리트'],
    tree: { trunk: '#6B4A2E', leaf: ['#4F7A3A', '#6B8F3F', '#3F6B2E'], shape: 'round', tall: 1.0 },
    creature: { skin: ['#8E8A80', '#B9A77C', '#6B5A3E'], accent: '#D4A94E' },
  },
  joseon: {
    name: '조선 · 1450년', tech: 4,
    palette: { wall: ['#E6DCC3', '#D8CDB4', '#C9B99A'], roof: ['#3A3A40', '#2F2F36', '#45454D'], accent: ['#B8412E', '#2E5B8A', '#4F6B3E'], trim: '#B8412E', ground: '#6E8A42' },
    roofs: ['tiered', 'tiered', 'hip'], footprints: ['rect', 'rect', 'L', 'polygon'],
    columns: 0.7, arches: 0.05, towers: 0.05, eave: 0.32, flare: 1.0, tiers: 1,
    materials: ['나무', '기와', '돌', '흙'], locked: ['철', '유리', '콘크리트'],
    tree: { trunk: '#5A3C22', leaf: ['#2F5A3A', '#3F6B45', '#4F7A4A'], shape: 'pine', tall: 1.3 },
    creature: { skin: ['#C9A85C', '#F2EFE6', '#4F4A42'], accent: '#B8412E' },
  },
  viking: {
    name: '스칸디나비아 · 870년', tech: 3,
    palette: { wall: ['#6B4A2E', '#5A3C22', '#7A5A3A'], roof: ['#5E7A3A', '#4F6B2E', '#6B8A42'], accent: ['#3E7F86', '#B8B5AA'], trim: '#B8B5AA', ground: '#5E7A3A' },
    roofs: ['gable', 'gable', 'hip'], footprints: ['rect', 'rect', 'rect', 'L'],
    columns: 0.1, arches: 0.0, towers: 0.2, eave: 0.2, flare: 1.08, tiers: 0,
    materials: ['통나무', '이끼', '돌', '뗏장'], locked: ['철', '유리', '벽돌'],
    tree: { trunk: '#4A3320', leaf: ['#2F4F2E', '#3A5A36', '#243E2A'], shape: 'pine', tall: 1.5 },
    creature: { skin: ['#4A3A2E', '#8E8A80', '#2A2420'], accent: '#3E7F86' },
  },
  andes: {
    name: '안데스 · 1200년', tech: 2,
    palette: { wall: ['#8E8A80', '#9B9790', '#7E7A70'], roof: ['#C68A4A', '#B07A3C', '#A6323C'], accent: ['#A6323C', '#7FB2D8'], trim: '#C68A4A', ground: '#C9A86A' },
    roofs: ['flat', 'flat', 'hip', 'stepped'], footprints: ['rect', 'rect', 'polygon', 'L'],
    columns: 0.0, arches: 0.0, towers: 0.0, eave: 0.05, flare: 0.96, tiers: 0,
    materials: ['돌', '황토', '짚', '직물'], locked: ['철', '바퀴', '유리'],
    tree: { trunk: '#6B5A3E', leaf: ['#7A8A3A', '#8FA35A', '#5E7A3A'], shape: 'sparse', tall: 0.8 },
    creature: { skin: ['#D9C9A8', '#F2EFE6', '#8E6A4A'], accent: '#A6323C' },
  },
};
