/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { SessionState, AiraEmotion } from "../types";

interface BedroomSceneProps {
  state: SessionState;
  emotion: AiraEmotion;
  mouthOpenness: number;
  userVolume: number;
  airaVolume: number;
  isMicActive: boolean;
}

export const BedroomScene: React.FC<BedroomSceneProps> = ({
  state,
  emotion,
  mouthOpenness,
  userVolume,
  airaVolume,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number | null>(null);

  // References to dynamic scene parts for high-performance animation updates
  const sceneStateRef = useRef({
    state,
    emotion,
    mouthOpenness,
    userVolume,
    airaVolume,
    targetMouse: { x: 0, y: 0 },
    currentMouse: { x: 0, y: 0 },
  });

  // Keep references synced
  useEffect(() => {
    sceneStateRef.current.state = state;
    sceneStateRef.current.emotion = emotion;
    sceneStateRef.current.mouthOpenness = mouthOpenness;
    sceneStateRef.current.userVolume = userVolume;
    sceneStateRef.current.airaVolume = airaVolume;
  }, [state, emotion, mouthOpenness, userVolume, airaVolume]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- 1. Three.js Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0d14); // Deep twilight room ambient
    scene.fog = new THREE.FogExp2(0x0c0d14, 0.04);

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    // Conversational framing: camera looking slightly down/level at AIRA sitting on the bed
    camera.position.set(0, 1.42, 3.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    // --- 2. Lighting (Cozy Warm Bedroom Lighting) ---
    // Warm Bedside Lamp Light
    const lampLight = new THREE.PointLight(0xffb366, 2.4, 8, 1.2);
    lampLight.position.set(-1.4, 1.6, 0.3);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.width = 1024;
    lampLight.shadow.mapSize.height = 1024;
    lampLight.shadow.bias = -0.001;
    scene.add(lampLight);

    // Soft Ambient Warm Fill
    const ambientLight = new THREE.AmbientLight(0x2d2538, 1.1);
    scene.add(ambientLight);

    // Subtle Cool Twilight Window Fill Light
    const windowLight = new THREE.DirectionalLight(0x4a628a, 0.75);
    windowLight.position.set(3.5, 3.0, 1.2);
    scene.add(windowLight);

    // Soft Rim Light on AIRA's hair and shoulders
    const rimLight = new THREE.DirectionalLight(0xffa07a, 0.65);
    rimLight.position.set(-2, 2.5, -2);
    scene.add(rimLight);

    // --- 3. Bedroom Architecture ---
    // Back Wall
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a24,
      roughness: 0.9,
      metalness: 0.1,
    });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), wallMat);
    backWall.position.set(0, 2.5, -2.5);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-3.5, 2.5, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Floor (Warm dark parquet wood tone)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x16131c,
      roughness: 0.45,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    floor.receiveShadow = true;
    scene.add(floor);

    // Bed Platform & Mattress
    const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x221a1f, roughness: 0.7 });
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x2e2738, roughness: 0.85 }); // Warm cozy duvet
    const sheetMat = new THREE.MeshStandardMaterial({ color: 0xe8dfd8, roughness: 0.9 }); // Clean cream sheet

    const bedGroup = new THREE.Group();
    // Base frame
    const bedBase = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 2.8), bedFrameMat);
    bedBase.position.set(0, 0.225, -0.4);
    bedBase.receiveShadow = true;
    bedBase.castShadow = true;
    bedGroup.add(bedBase);

    // Mattress
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.35, 2.65), sheetMat);
    mattress.position.set(0, 0.55, -0.4);
    mattress.receiveShadow = true;
    mattress.castShadow = true;
    bedGroup.add(mattress);

    // Duvet / Quilt covering lower portion of bed
    const duvet = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.22, 1.8), bedMat);
    duvet.position.set(0, 0.68, 0.05);
    duvet.receiveShadow = true;
    duvet.castShadow = true;
    bedGroup.add(duvet);

    // Pillows propped behind
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xd8cee0, roughness: 0.95 });
    const pillowLeft = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.45), pillowMat);
    pillowLeft.position.set(-0.55, 0.8, -1.25);
    pillowLeft.rotation.x = -0.3;
    pillowLeft.castShadow = true;
    bedGroup.add(pillowLeft);

    const pillowRight = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.45), pillowMat);
    pillowRight.position.set(0.55, 0.8, -1.25);
    pillowRight.rotation.x = -0.3;
    pillowRight.castShadow = true;
    bedGroup.add(pillowRight);

    // Bedside Nightstand Table
    const nightstand = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.6), bedFrameMat);
    nightstand.position.set(-1.5, 0.375, -0.7);
    nightstand.receiveShadow = true;
    nightstand.castShadow = true;
    bedGroup.add(nightstand);

    // Table Lamp
    const lampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 0.3, 16),
      new THREE.MeshStandardMaterial({ color: 0x8a7158, metalness: 0.7, roughness: 0.3 })
    );
    lampBase.position.set(-1.45, 0.85, -0.65);
    bedGroup.add(lampBase);

    // Glowing Lamp Shade
    const lampShadeMat = new THREE.MeshStandardMaterial({
      color: 0xffd9aa,
      emissive: 0xffa344,
      emissiveIntensity: 0.95,
      roughness: 0.3,
    });
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.38, 20, 1, true), lampShadeMat);
    lampShade.position.set(-1.45, 1.15, -0.65);
    bedGroup.add(lampShade);

    // Bedside Warm Ceramic Mug
    const mugMat = new THREE.MeshStandardMaterial({ color: 0xdf8276, roughness: 0.6 });
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 14), mugMat);
    mug.position.set(-1.3, 0.8, -0.5);
    bedGroup.add(mug);

    // Bedroom Window on Right Wall
    const windowFrame = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x222432, roughness: 0.6 });
    const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 1.8), frameMat);
    outerFrame.position.set(3.45, 2.4, -0.5);
    windowFrame.add(outerFrame);

    // Twilight Sky Texture / Plane behind window
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x11162b });
    const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.1), skyMat);
    skyPlane.rotation.y = -Math.PI / 2;
    skyPlane.position.set(3.44, 2.4, -0.5);
    windowFrame.add(skyPlane);

    // Star points in window
    const starGeo = new THREE.BufferGeometry();
    const starCoords: number[] = [];
    for (let i = 0; i < 40; i++) {
      starCoords.push(
        3.43,
        1.5 + Math.random() * 1.7,
        -1.3 + Math.random() * 1.6
      );
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starCoords, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xebd2ff, size: 0.035 });
    const stars = new THREE.Points(starGeo, starMat);
    windowFrame.add(stars);

    scene.add(windowFrame);
    scene.add(bedGroup);

    // --- 4. AIRA Character (Seated Naturally on the Bed) ---
    const airaGroup = new THREE.Group();
    // Sitting posture placed directly on top of the mattress
    airaGroup.position.set(0.05, 0.72, -0.55);

    // Materials for AIRA
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf9dfd1,
      roughness: 0.65,
      metalness: 0.05,
    });
    const lipsMat = new THREE.MeshStandardMaterial({
      color: 0xe07278,
      roughness: 0.45,
      metalness: 0.05,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x3d2724, // Warm dark chestnut brown hair
      roughness: 0.8,
      metalness: 0.1,
    });
    const sweaterMat = new THREE.MeshStandardMaterial({
      color: 0xc4637b, // Cozy dusty rose / mauve knit sweater
      roughness: 0.9,
    });
    const denimMat = new THREE.MeshStandardMaterial({
      color: 0x374563, // Relaxed denim home loungewear
      roughness: 0.85,
    });

    // Seated Legs (tucked comfortably cross-legged / angled on the bed)
    const legsGroup = new THREE.Group();
    // Thigh Left
    const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.52, 16), denimMat);
    thighL.rotation.x = Math.PI / 2.2;
    thighL.rotation.z = -0.35;
    thighL.position.set(-0.24, 0.12, 0.28);
    legsGroup.add(thighL);

    // Thigh Right
    const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.52, 16), denimMat);
    thighR.rotation.x = Math.PI / 2.2;
    thighR.rotation.z = 0.35;
    thighR.position.set(0.24, 0.12, 0.28);
    legsGroup.add(thighR);

    // Lower legs tucked on bed
    const calfL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.48, 16), denimMat);
    calfL.rotation.z = Math.PI / 2.3;
    calfL.rotation.x = 0.15;
    calfL.position.set(0.08, 0.06, 0.5);
    legsGroup.add(calfL);

    const calfR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.48, 16), denimMat);
    calfR.rotation.z = -Math.PI / 2.3;
    calfR.rotation.x = 0.15;
    calfR.position.set(-0.08, 0.06, 0.5);
    legsGroup.add(calfR);

    airaGroup.add(legsGroup);

    // Torso Group (Breathing & posture articulation)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.22, 0);

    // Cozy knit sweater body
    const sweaterBody = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.21, 0.58, 20), sweaterMat);
    sweaterBody.position.set(0, 0.29, 0);
    sweaterBody.castShadow = true;
    torsoGroup.add(sweaterBody);

    // Relaxed Arms resting forward near lap
    // Left Upper Arm
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.38, 14), sweaterMat);
    armL.position.set(-0.28, 0.38, 0.04);
    armL.rotation.x = 0.4;
    armL.rotation.z = 0.2;
    torsoGroup.add(armL);

    // Left Forearm
    const forearmL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.32, 14), skinMat);
    forearmL.position.set(-0.2, 0.18, 0.22);
    forearmL.rotation.x = Math.PI / 2.3;
    forearmL.rotation.y = -0.3;
    torsoGroup.add(forearmL);

    // Right Upper Arm
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.38, 14), sweaterMat);
    armR.position.set(0.28, 0.38, 0.04);
    armR.rotation.x = 0.4;
    armR.rotation.z = -0.2;
    torsoGroup.add(armR);

    // Right Forearm
    const forearmR = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.32, 14), skinMat);
    forearmR.position.set(0.2, 0.18, 0.22);
    forearmR.rotation.x = Math.PI / 2.3;
    forearmR.rotation.y = 0.3;
    torsoGroup.add(forearmR);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.082, 0.14, 16), skinMat);
    neck.position.set(0, 0.62, 0.02);
    torsoGroup.add(neck);

    // --- Head Group (Turns to look at user, nods, head-tilts) ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.73, 0.04);

    // Face / Head Shape
    const faceGeo = new THREE.SphereGeometry(0.18, 24, 24);
    faceGeo.scale(0.9, 1.05, 0.95);
    const faceMesh = new THREE.Mesh(faceGeo, skinMat);
    faceMesh.castShadow = true;
    headGroup.add(faceMesh);

    // Stylish Hair (curling gently over shoulders and bangs)
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.205, 20, 20), hairMat);
    hairTop.position.set(0, 0.04, -0.02);
    hairTop.scale.set(0.96, 1.02, 1.05);
    headGroup.add(hairTop);

    // Side hair locks framing face
    const lockL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.44, 10), hairMat);
    lockL.position.set(-0.16, -0.1, 0.08);
    lockL.rotation.z = -0.15;
    headGroup.add(lockL);

    const lockR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.44, 10), hairMat);
    lockR.position.set(0.16, -0.1, 0.08);
    lockR.rotation.z = 0.15;
    headGroup.add(lockR);

    // Eyes with Pupils & Eyelids (Blink & gaze control)
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const irisMat = new THREE.MeshBasicMaterial({ color: 0x3d271d }); // Warm expressive dark eyes
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const createEye = (isLeft: boolean) => {
      const eyeGroup = new THREE.Group();
      const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 16), eyeWhiteMat);
      eyeGroup.add(eyeball);

      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), irisMat);
      iris.position.set(0, 0, 0.036);
      eyeGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.012, 16), pupilMat);
      pupil.position.set(0, 0, 0.037);
      eyeGroup.add(pupil);

      // Eye highlight (sparkle of life)
      const highlight = new THREE.Mesh(new THREE.CircleGeometry(0.005, 8), eyeWhiteMat);
      highlight.position.set(0.007, 0.007, 0.038);
      eyeGroup.add(highlight);

      // Upper Eyelid for Blinking (scales vertically down to 1.0 during blink)
      const eyelidGeo = new THREE.SphereGeometry(0.041, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const eyelid = new THREE.Mesh(eyelidGeo, skinMat);
      eyelid.rotation.x = Math.PI;
      eyelid.position.set(0, 0, 0);
      eyelid.scale.set(1, 0, 1); // 0 = fully open, 1 = fully shut
      eyeGroup.add(eyelid);

      eyeGroup.position.set(isLeft ? -0.065 : 0.065, 0.025, 0.16);
      return { eyeGroup, eyelid, iris, pupil };
    };

    const leftEye = createEye(true);
    const rightEye = createEye(false);
    headGroup.add(leftEye.eyeGroup);
    headGroup.add(rightEye.eyeGroup);

    // Eyebrows
    const browMat = new THREE.MeshBasicMaterial({ color: 0x2e1e1b });
    const browL = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.012, 0.01), browMat);
    browL.position.set(-0.068, 0.078, 0.165);
    browL.rotation.z = 0.08;
    headGroup.add(browL);

    const browR = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.012, 0.01), browMat);
    browR.position.set(0.068, 0.078, 0.165);
    browR.rotation.z = -0.08;
    headGroup.add(browR);

    // Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 8), skinMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, -0.015, 0.19);
    headGroup.add(nose);

    // Mouth / Lips Group (Driven smoothly by AudioReactiveController & Lip Sync)
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.078, 0.165);

    // Upper Lip
    const upperLip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.052, 10), lipsMat);
    upperLip.rotation.z = Math.PI / 2;
    upperLip.position.set(0, 0.008, 0.01);
    mouthGroup.add(upperLip);

    // Lower Lip
    const lowerLip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.048, 10), lipsMat);
    lowerLip.rotation.z = Math.PI / 2;
    lowerLip.position.set(0, -0.008, 0.01);
    mouthGroup.add(lowerLip);

    // Inner Mouth Cavity (visible when mouth opens during speech)
    const mouthCavityMat = new THREE.MeshBasicMaterial({ color: 0x3d1418 });
    const mouthCavity = new THREE.Mesh(new THREE.PlaneGeometry(0.048, 0.04), mouthCavityMat);
    mouthCavity.position.set(0, 0, 0.005);
    mouthCavity.scale.set(1, 0, 1);
    mouthGroup.add(mouthCavity);

    headGroup.add(mouthGroup);
    torsoGroup.add(headGroup);
    airaGroup.add(torsoGroup);
    scene.add(airaGroup);

    // --- 5. Natural Animation & Idle Loop ---
    let clock = new THREE.Clock();
    let nextBlinkTime = 2.0;
    let blinkProgress = 0;
    let isBlinking = false;

    // Mouse movement listener for subtle 3D parallax & gaze tracking
    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      sceneStateRef.current.targetMouse.x = THREE.MathUtils.clamp(x, -1, 1);
      sceneStateRef.current.targetMouse.y = THREE.MathUtils.clamp(y, -1, 1);
    };
    window.addEventListener("pointermove", handlePointerMove);

    // --- Render Loop (60 FPS) ---
    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const cur = sceneStateRef.current;

      // Mouse parallax smoothing
      cur.currentMouse.x += (cur.targetMouse.x - cur.currentMouse.x) * 0.05;
      cur.currentMouse.y += (cur.targetMouse.y - cur.currentMouse.y) * 0.05;

      // 1. Natural Breathing Cycle (0.28 Hz gentle sinusoidal rhythm)
      const breathing = Math.sin(elapsed * 1.75);
      torsoGroup.position.y = 0.22 + breathing * 0.012;
      torsoGroup.rotation.x = breathing * 0.015;
      sweaterBody.scale.x = 1.0 + breathing * 0.02;
      sweaterBody.scale.z = 1.0 + breathing * 0.02;

      // 2. Head Orientation & Conversational Focus
      let targetHeadPitch = 0;
      let targetHeadYaw = 0;
      let targetHeadRoll = 0;

      if (cur.state === "LISTENING") {
        // Attentive tilt when listening to user
        targetHeadPitch = 0.08 + Math.sin(elapsed * 3) * 0.02;
        targetHeadRoll = -0.06;
        targetHeadYaw = cur.currentMouse.x * 0.12;
      } else if (cur.state === "THINKING") {
        // Gentle thoughtful upward gaze
        targetHeadPitch = -0.12;
        targetHeadYaw = 0.14;
        targetHeadRoll = 0.04;
      } else if (cur.state === "SPEAKING") {
        // Expressive subtle conversational cadence
        const speechSway = Math.sin(elapsed * 4) * 0.04;
        targetHeadPitch = 0.02 + speechSway * 0.5;
        targetHeadYaw = cur.currentMouse.x * 0.18 + Math.sin(elapsed * 2) * 0.03;
        targetHeadRoll = Math.sin(elapsed * 2.5) * 0.03;
      } else {
        // IDLE natural presence
        targetHeadYaw = cur.currentMouse.x * 0.15 + Math.sin(elapsed * 0.5) * 0.04;
        targetHeadPitch = cur.currentMouse.y * 0.1 + Math.cos(elapsed * 0.8) * 0.02;
        targetHeadRoll = Math.sin(elapsed * 0.4) * 0.02;
      }

      headGroup.rotation.x += (targetHeadPitch - headGroup.rotation.x) * 0.08;
      headGroup.rotation.y += (targetHeadYaw - headGroup.rotation.y) * 0.08;
      headGroup.rotation.z += (targetHeadRoll - headGroup.rotation.z) * 0.08;

      // 3. Eyeball Gaze Tracking (Micro-saccades)
      const gazeX = cur.currentMouse.x * 0.007 + (Math.sin(elapsed * 1.5) > 0.9 ? 0.002 : 0);
      const gazeY = cur.currentMouse.y * 0.006;
      leftEye.iris.position.x = THREE.MathUtils.clamp(gazeX, -0.008, 0.008);
      leftEye.iris.position.y = THREE.MathUtils.clamp(gazeY, -0.008, 0.008);
      leftEye.pupil.position.x = leftEye.iris.position.x;
      leftEye.pupil.position.y = leftEye.iris.position.y;
      rightEye.iris.position.x = leftEye.iris.position.x;
      rightEye.iris.position.y = leftEye.iris.position.y;
      rightEye.pupil.position.x = leftEye.iris.position.x;
      rightEye.pupil.position.y = leftEye.iris.position.y;

      // 4. Organic Blinking (Triggers every 3-5 seconds naturally)
      if (elapsed > nextBlinkTime && !isBlinking) {
        isBlinking = true;
        blinkProgress = 0;
      }

      if (isBlinking) {
        blinkProgress += delta * 7; // Fast natural blink ~140ms
        if (blinkProgress >= Math.PI) {
          isBlinking = false;
          nextBlinkTime = elapsed + 2.5 + Math.random() * 3.5;
          leftEye.eyelid.scale.y = 0;
          rightEye.eyelid.scale.y = 0;
        } else {
          const blinkValue = Math.sin(blinkProgress);
          leftEye.eyelid.scale.y = blinkValue * 1.05;
          rightEye.eyelid.scale.y = blinkValue * 1.05;
        }
      }

      // 5. Lip Sync & Mouth Articulation (Section 11 & 12 of PRD)
      // Driven directly by the real-time audio reactive openness value
      const openness = cur.mouthOpenness;
      // Animate lips opening vertically and lower lip dropping
      lowerLip.position.y = -0.008 - openness * 0.028;
      upperLip.position.y = 0.008 + openness * 0.012;
      // Stretch mouth cavity vertically
      mouthCavity.scale.y = openness * 1.4;
      mouthCavity.scale.x = 0.8 + openness * 0.4;

      // 6. Facial Expressions based on Emotion
      if (cur.emotion === "HAPPY" || cur.emotion === "AMUSED" || cur.emotion === "PLAYFUL") {
        // Gentle smile curve
        upperLip.rotation.z = Math.PI / 2 + 0.1;
        browL.position.y = 0.082;
        browR.position.y = 0.082;
      } else if (cur.emotion === "THOUGHTFUL") {
        browL.position.y = 0.072;
        browR.position.y = 0.086; // One eyebrow playfully raised
      } else {
        upperLip.rotation.z = Math.PI / 2;
        browL.position.y = 0.078;
        browR.position.y = 0.078;
      }

      // 7. Subtle Camera Breathing Parallax
      camera.position.x = cur.currentMouse.x * 0.15;
      camera.position.y = 1.42 + cur.currentMouse.y * 0.08 + Math.sin(elapsed * 0.6) * 0.015;
      camera.lookAt(0, 1.35, -0.4);

      renderer.render(scene, camera);
    };

    animate();

    // Responsive Canvas Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) return;
        camera.aspect = width / height;
        // On narrow mobile screens, adjust camera field-of-view so AIRA stays nicely centered
        if (width < 640) {
          camera.fov = 48;
          camera.position.z = 3.8;
        } else {
          camera.fov = 38;
          camera.position.z = 3.4;
        }
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });

    resizeObserver.observe(container);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      window.removeEventListener("pointermove", handlePointerMove);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="aira-bedroom-canvas"
      className="absolute inset-0 w-full h-full overflow-hidden select-none"
      style={{ touchAction: "none" }}
    />
  );
};
