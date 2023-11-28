import Color from './color.js';

export default interface Dataset<Sample> {
  label: string;
  samples: Sample[];
  color: Color;
}

export type Datasets<Sample> = Dataset<Sample>[];
