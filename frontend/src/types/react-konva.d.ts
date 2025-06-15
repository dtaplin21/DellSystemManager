declare module 'react-konva' {
  import { Component, RefObject } from 'react';
  import { Stage as KonvaStage, Layer as KonvaLayer, Group as KonvaGroup, Rect as KonvaRect, RegularPolygon as KonvaRegularPolygon, Transformer as KonvaTransformer } from 'konva';
  
  export class Stage extends Component<any> {
    getStage(): KonvaStage;
  }
  export class Layer extends Component<any> {
    getLayer(): KonvaLayer;
  }
  export class Group extends Component<any> {
    getNode(): KonvaGroup;
  }
  export class Rect extends Component<any> {
    getNode(): KonvaRect;
  }
  export class RegularPolygon extends Component<any> {
    getNode(): KonvaRegularPolygon;
  }
  export class Transformer extends Component<any> {
    getNode(): KonvaTransformer;
  }
} 