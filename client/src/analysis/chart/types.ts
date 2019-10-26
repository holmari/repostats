export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Margins {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}
export interface ChartShape {
  readonly size: Size;
  readonly margins: Margins;
}

export interface DateValue {
  readonly date: Date;
  readonly value: number;
}

export interface ChartDataSeries {
  readonly label: string;
  readonly color: string;
  readonly series: ReadonlyArray<DateValue>;
}
