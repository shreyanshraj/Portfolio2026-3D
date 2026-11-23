// The desert-morning palette. Kenney's models ship flat, unlit materials;
// we swap each one for a lit standard material in these colors so the
// sunrise can actually light the room.
export const C = {
  haze: '#CFDCE3',
  plaster: '#E3DCCD',
  ink: '#2E3550',
  saguaro: '#5E7A5A',
  sun: '#F2C14E',
  paper: '#F7F8F5',
  predawn: '#3A4566',
}

// Kenney material name -> colour, used unless a model overrides it.
export const BASE: Record<string, string> = {
  wood: '#B39672',
  woodDark: '#8E7356',
  metal: '#B7BDC6',
  metalMedium: '#6B7488',
  metalDark: '#2E3550',
  plant: '#5E7A5A',
  carpet: '#7C8DA6',
  carpetDarker: '#55627A',
  carpetWhite: '#F7F8F5',
  carpetBlue: '#C9A24A',
  lamp: '#F2D79A',
}
