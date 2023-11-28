import Dataset from './dataset.js';

export default interface Adapter<Sample> {
  /** @return the chart x value for the sample */
  x: (sample: Sample) => number;
  /** @return the chart y value for the sample */
  y: (sample: Sample) => number;
  /** @return the chart x-axis label for given x value */
  x_axis_label: (value: number) => string;
  /** @return the chart y-axis label for given y value */
  y_axis_label: (value: number) => string;
  /** @return the tooltip text */
  tooltip: (sample: Sample, dataset: Dataset<Sample>) => string;
}
