import { useEffect, useRef } from 'react';
import { Text as KonvaText } from 'react-konva/lib/ReactKonvaCore';

interface TextProps {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align: string;
  verticalAlign: string;
  offsetX: number;
  offsetY: number;
}

export const Text = (props: TextProps) => {
  return <KonvaText {...props} />;
}; 