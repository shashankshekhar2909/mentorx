"use client";

import { useEffect, useRef } from "react";

export function GraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const mouse = { nx: 0, ny: 0 };

    function onMouseMove(e: MouseEvent) {
      mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ny = (e.clientY / window.innerHeight) * 2 - 1;
    }

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);

    const NODE_COUNT = 80;
    type Node3D = { x: number; y: number; z: number; pulse: number };

    function randInSphere(r: number): Node3D {
      const u = Math.random(), v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const radius = r * (0.3 + Math.random() * 0.7);
      return {
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
        pulse: Math.random() * Math.PI * 2,
      };
    }

    // Sphere radius sized to cover the full viewport diagonal
    const SPHERE_R = 520;
    const nodes: Node3D[] = Array.from({ length: NODE_COUNT }, () => randInSphere(SPHERE_R));

    // Prim spanning tree
    type Edge = { a: number; b: number };
    const edges: Edge[] = [];
    const inTree = new Set<number>([0]);
    while (inTree.size < NODE_COUNT) {
      let bestDist = Infinity, bestA = -1, bestB = -1;
      inTree.forEach((i) => {
        for (let j = 0; j < NODE_COUNT; j++) {
          if (inTree.has(j)) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dz = nodes[i].z - nodes[j].z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < bestDist) { bestDist = d; bestA = i; bestB = j; }
        }
      });
      if (bestA < 0) break;
      edges.push({ a: bestA, b: bestB });
      inTree.add(bestB);
    }
    // Extra nearby edges
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dz = nodes[i].z - nodes[j].z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 160) {
          edges.push({ a: i, b: j });
        }
      }
    }

    let ry = 0;
    const FOV = 600;
    const DEPTH_RANGE = SPHERE_R * 2;

    function project(
      n: Node3D,
      cosRy: number, sinRy: number,
      cosRx: number, sinRx: number,
      cx: number, cy: number
    ) {
      const x1 = n.x * cosRy + n.z * sinRy;
      const z1 = -n.x * sinRy + n.z * cosRy;
      const y2 = n.y * cosRx - z1 * sinRx;
      const z2 = n.y * sinRx + z1 * cosRx;
      const scale = FOV / (z2 + FOV);
      return { sx: cx + x1 * scale, sy: cy + y2 * scale, z: z2, scale };
    }

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const now = Date.now();

      ry += 0.0022;
      const rx = 0.16 + mouse.ny * 0.10;
      const targetRy = ry + mouse.nx * 0.07;

      const cosRy = Math.cos(targetRy), sinRy = Math.sin(targetRy);
      const cosRx = Math.cos(rx), sinRx = Math.sin(rx);

      const projected = nodes.map((n) => project(n, cosRy, sinRy, cosRx, sinRx, cx, cy));

      const sortedEdges = [...edges].sort(
        (a, b) =>
          (projected[a.a].z + projected[a.b].z) / 2 -
          (projected[b.a].z + projected[b.b].z) / 2
      );

      // Edges
      sortedEdges.forEach(({ a, b }) => {
        const pa = projected[a], pb = projected[b];
        const avgZ = (pa.z + pb.z) / 2;
        const depth = Math.max(0, Math.min(1, (avgZ + SPHERE_R) / DEPTH_RANGE));
        const alpha = 0.05 + depth * 0.20;

        const grad = ctx!.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy);
        grad.addColorStop(0, `rgba(124,58,237,${(alpha * pa.scale).toFixed(3)})`);
        grad.addColorStop(1, `rgba(6,182,212,${(alpha * pb.scale).toFixed(3)})`);
        ctx!.save();
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 0.5 + depth * 0.7;
        ctx!.beginPath();
        ctx!.moveTo(pa.sx, pa.sy);
        ctx!.lineTo(pb.sx, pb.sy);
        ctx!.stroke();
        ctx!.restore();
      });

      // Nodes back-to-front
      projected
        .map((p, i) => ({ ...p, i }))
        .sort((a, b) => a.z - b.z)
        .forEach(({ sx, sy, z, scale, i }) => {
          const depth = Math.max(0, Math.min(1, (z + SPHERE_R) / DEPTH_RANGE));
          const pulse = 0.7 + Math.sin(now / 1400 + nodes[i].pulse) * 0.3;
          const r = (1.5 + depth * 3) * scale * pulse;
          const alpha = 0.2 + depth * 0.7;
          const nodeColor =
            depth < 0.4
              ? `rgba(124,58,237,${alpha.toFixed(2)})`
              : depth < 0.72
              ? `rgba(59,130,246,${alpha.toFixed(2)})`
              : `rgba(6,182,212,${alpha.toFixed(2)})`;

          const glow = ctx!.createRadialGradient(sx, sy, 0, sx, sy, r * 3.5);
          glow.addColorStop(0, nodeColor);
          glow.addColorStop(1, "transparent");
          ctx!.save();
          ctx!.fillStyle = glow;
          ctx!.beginPath();
          ctx!.arc(sx, sy, r * 3.5, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.restore();

          ctx!.save();
          ctx!.fillStyle = nodeColor;
          ctx!.beginPath();
          ctx!.arc(sx, sy, r, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.restore();
        });

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 h-screen w-screen"
      style={{ zIndex: 0 }}
    />
  );
}
