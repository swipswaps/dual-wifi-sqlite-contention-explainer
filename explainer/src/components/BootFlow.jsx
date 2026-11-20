import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function BootFlow() {
  const host = useRef(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1020');

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 3.8, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    node.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const keyLight = new THREE.PointLight(0x72e0c0, 35);
    keyLight.position.set(3, 5, 5);
    scene.add(keyLight);

    const makeMaterial = (color) =>
      new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.38 });

    const stageCoords = [
      [-3.1, 0, 0, 0x6ea8ff],
      [-1.05, 0, 0, 0xe7b86a],
      [1.05, 0, 0, 0x8bdfb7],
      [3.1, 0, 0, 0xc19cff]
    ];

    const meshes = stageCoords.map(([x, y, z, color]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.05, 0.72), makeMaterial(color));
      mesh.position.set(x, y, z);
      scene.add(mesh);
      return mesh;
    });

    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-2.42, 0, 0), new THREE.Vector3(-1.72, 0, 0),
      new THREE.Vector3(-0.42, 0, 0), new THREE.Vector3(0.42, 0, 0),
      new THREE.Vector3(1.68, 0, 0), new THREE.Vector3(2.48, 0, 0)
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x91a8c9 });
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);

    const resize = () => {
      const width = Math.max(node.clientWidth, 320);
      const height = 250;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(node);

    let frame = 0;
    let raf = 0;
    const animate = () => {
      frame += 0.006;
      meshes.forEach((mesh, idx) => {
        mesh.rotation.y = Math.sin(frame + idx * 0.7) * 0.12;
        mesh.position.y = Math.sin(frame * 1.4 + idx) * 0.08;
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      lineGeo.dispose();
      lineMat.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="three-host" ref={host} aria-label="3D pipeline flow diagram" />;
}
