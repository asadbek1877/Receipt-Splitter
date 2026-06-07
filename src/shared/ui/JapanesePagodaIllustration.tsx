import React from 'react';
import { View } from 'tamagui';
import { Svg, Path, Circle, Rect, Polygon, G, Ellipse, Line } from 'react-native-svg';

export const JapanesePagodaIllustration = ({ width = 280, height = 280 }) => {
  return (
    <View 
      width={width} 
      height={height}
      ai="center"
      jc="center"
    >
      <Svg width={width} height={height} viewBox="0 0 280 280">
        {/* Sky gradient - light pink */}
        <Rect width={280} height={280} fill="#FFF0F5" />

        {/* Sun */}
        <Circle cx={220} cy={50} r={35} fill="#FFB3C1" opacity={0.9} />

        {/* Birds in sky */}
        <G>
          <Path d="M 40 60 Q 45 55 50 60" stroke="#DEB3D4" strokeWidth="1.5" fill="none" />
          <Path d="M 55 65 Q 60 60 65 65" stroke="#DEB3D4" strokeWidth="1.5" fill="none" />
          <Path d="M 200 80 Q 205 75 210 80" stroke="#DEB3D4" strokeWidth="1.5" fill="none" />
        </G>

        {/* Mountains background */}
        <Path 
          d="M 0 200 Q 70 120 140 140 Q 210 160 280 120 L 280 280 L 0 280 Z" 
          fill="#C0E0E8" 
          opacity={0.6}
        />
        <Path 
          d="M 0 220 Q 80 160 140 170 Q 200 180 280 150 L 280 280 L 0 280 Z" 
          fill="#A8D8E1" 
          opacity={0.5}
        />

        {/* Pagoda Main Towers */}
        {/* Left Pagoda */}
        <G>
          {/* Base */}
          <Rect x={50} y={160} width={50} height={40} fill="#D84D6A" />
          
          {/* Tower 1 */}
          <Rect x={58} y={140} width={34} height={30} fill="#E84C7C" />
          {/* Roof 1 */}
          <Polygon points="58,140 96,140 100,135 54,135" fill="#C23A5A" />
          
          {/* Tower 2 */}
          <Rect x={62} y={115} width={26} height={25} fill="#E84C7C" />
          {/* Roof 2 */}
          <Polygon points="62,115 88,115 91,110 59,110" fill="#C23A5A" />
          
          {/* Tower 3 (top) */}
          <Rect x={66} y={95} width={18} height={20} fill="#E84C7C" />
          {/* Roof 3 */}
          <Polygon points="66,95 84,95 87,90 63,90" fill="#C23A5A" />
          
          {/* Spire */}
          <Polygon points="72,90 78,90 75,75" fill="#FF6B9D" />
        </G>

        {/* Right (Center) Pagoda - Taller */}
        <G>
          {/* Base */}
          <Rect x={130} y={150} width={60} height={50} fill="#D84D6A" />
          
          {/* Tower 1 */}
          <Rect x={137} y={125} width={46} height={30} fill="#E84C7C" />
          {/* Roof 1 */}
          <Polygon points="137,125 183,125 188,120 132,120" fill="#C23A5A" />
          
          {/* Tower 2 */}
          <Rect x={142} y={95} width={36} height={30} fill="#E84C7C" />
          {/* Roof 2 */}
          <Polygon points="142,95 178,95 183,90 137,90" fill="#C23A5A" />
          
          {/* Tower 3 */}
          <Rect x={148} y={70} width={26} height={25} fill="#E84C7C" />
          {/* Roof 3 */}
          <Polygon points="148,70 174,70 178,65 144,65" fill="#C23A5A" />
          
          {/* Tower 4 (top) */}
          <Rect x={154} y={50} width={16} height={20} fill="#E84C7C" />
          {/* Roof 4 */}
          <Polygon points="154,50 170,50 173,45 151,45" fill="#C23A5A" />
          
          {/* Spire */}
          <Polygon points="160,45 166,45 163,28" fill="#FF6B9D" />
        </G>

        {/* Right Pagoda */}
        <G>
          {/* Base */}
          <Rect x={200} y={165} width={45} height={35} fill="#D84D6A" />
          
          {/* Tower 1 */}
          <Rect x={207} y={145} width={31} height={25} fill="#E84C7C" />
          {/* Roof 1 */}
          <Polygon points="207,145 238,145 242,140 203,140" fill="#C23A5A" />
          
          {/* Tower 2 */}
          <Rect x={211} y={120} width={23} height={25} fill="#E84C7C" />
          {/* Roof 2 */}
          <Polygon points="211,120 234,120 237,115 208,115" fill="#C23A5A" />
          
          {/* Tower 3 */}
          <Rect x={215} y={100} width={15} height={20} fill="#E84C7C" />
          {/* Roof 3 */}
          <Polygon points="215,100 230,100 232,95 213,95" fill="#C23A5A" />
          
          {/* Spire */}
          <Polygon points="220,95 225,95 222,85" fill="#FF6B9D" />
        </G>

        {/* Floating clouds */}
        <G opacity={0.7}>
          <Ellipse cx={80} cy={80} rx={25} ry={15} fill="#FFE5EC" />
          <Ellipse cx={95} cy={85} rx={20} ry={12} fill="#FFE5EC" />
          <Ellipse cx={65} cy={85} rx={18} ry={11} fill="#FFE5EC" />
          
          <Ellipse cx={220} cy={150} rx={22} ry={14} fill="#FFE5EC" />
          <Ellipse cx={235} cy={155} rx={18} ry={10} fill="#FFE5EC" />
        </G>

        {/* Sakura petals falling */}
        <G opacity={0.6}>
          <Circle cx={30} cy={120} r={2} fill="#FFB3C1" />
          <Circle cx={100} cy={180} r={1.5} fill="#FFB3C1" />
          <Circle cx={250} cy={140} r={2} fill="#FFB3C1" />
          <Circle cx={150} cy={200} r={1.5} fill="#FFB3C1" />
          <Circle cx={70} cy={170} r={1} fill="#FFB3C1" />
        </G>
      </Svg>
    </View>
  );
};

export default JapanesePagodaIllustration;
