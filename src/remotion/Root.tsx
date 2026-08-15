/**
 * Remotion Root Registration File
 * Batch Music Visualizer Engine
 */

import React from 'react';
import { Composition } from 'remotion';
import { VisualizerComposition } from './VisualizerComposition.js';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VisualizerLandscape"
        component={VisualizerComposition}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          audioPath: '',
          presetName: 'DEFAULT',
          aspectRatio: 'LANDSCAPE',
          trackTitle: 'Landscape Visualizer Track',
          artistName: 'Artist Name',
          albumName: 'Album Name',
        }}
      />
      <Composition
        id="VisualizerPortrait"
        component={VisualizerComposition}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          audioPath: '',
          presetName: 'DEFAULT',
          aspectRatio: 'PORTRAIT',
          trackTitle: 'Portrait Visualizer Track',
          artistName: 'Artist Name',
          albumName: 'Album Name',
        }}
      />
    </>
  );
};
