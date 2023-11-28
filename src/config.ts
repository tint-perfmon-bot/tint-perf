import Adapter from './adapter.js';
import Dataset from './dataset.js';
import Rect from './rect.js';

export default interface Config<Sample> {
  adapter: Adapter<Sample>;
  margin?: Rect;
  on_click?: (sample: Sample, dataset: Dataset<Sample>) => void;
}
