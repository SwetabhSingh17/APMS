import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float } from '@react-three/drei';
import * as THREE from 'three';

interface PhaseProgress {
  label: string;
  percentage: number;
  color: string;
  position: [number, number, number];
}

const ProgressRing = ({ label, percentage, color, position }: PhaseProgress) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  // Calculate the arc length for the progress ring
  const arcLength = (percentage / 100) * Math.PI * 2;

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1} position={position}>
      <group ref={meshRef as any}>
        {/* Background Ring */}
        <mesh>
          <torusGeometry args={[1.8, 0.1, 16, 100]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.1} />
        </mesh>
        
        {/* Progress Ring */}
        <mesh ref={ringRef as any} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[1.8, 0.12, 16, 100, arcLength]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
        </mesh>

        {/* Center Text */}
        <Text
          position={[0, 0.2, 0]}
          fontSize={0.4}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {`${Math.round(percentage)}%`}
        </Text>
        <Text
          position={[0, -0.4, 0]}
          fontSize={0.25}
          color="#aaaaaa"
          anchorX="center"
          anchorY="middle"
          maxWidth={2}
          textAlign="center"
        >
          {label}
        </Text>
      </group>
    </Float>
  );
};

interface Progress3DProps {
  stats?: {
    topicSelection: number;
    research: number;
    implementation: number;
    testing: number;
  };
}

export default function Progress3D({ stats }: Progress3DProps) {
  const defaultStats = {
    topicSelection: 0,
    research: 0,
    implementation: 0,
    testing: 0,
    ...stats
  };

  const phases: PhaseProgress[] = [
    { label: 'Topic Selection', percentage: defaultStats.topicSelection, color: '#3b82f6', position: [-4.5, 2, 0] },
    { label: 'Research', percentage: defaultStats.research, color: '#10b981', position: [0, -2, 2] },
    { label: 'Implementation', percentage: defaultStats.implementation, color: '#8b5cf6', position: [4.5, 2, 0] },
    { label: 'Testing', percentage: defaultStats.testing, color: '#ef4444', position: [0, 2, -4.5] },
  ];

  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden bg-background/40 backdrop-blur-xl border border-white/20 dark:border-white/10 relative">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          3D Project Progress Matrix
        </h3>
        <p className="text-sm text-muted-foreground">Interactive spatial visualization of all active projects.</p>
      </div>
      <Canvas camera={{ position: [0, 3, 12], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        

        
        {phases.map((phase, index) => (
          <ProgressRing key={index} {...phase} />
        ))}

        <OrbitControls 
          enableZoom={true} 
          enablePan={false} 
          minPolarAngle={Math.PI / 4} 
          maxPolarAngle={Math.PI / 1.5} 
          autoRotate={true}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
