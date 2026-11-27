import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useUiStore } from '@/shared/store/uiStore'

/**
 * Full-viewport ambient Three.js 3D scene with floating geometric meshes,
 * particle field, and subtle mouse/touch parallax.
 */
export default function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let renderer: THREE.WebGLRenderer | null = null
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      return
    }

    const isDark = theme === 'dark'
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 100)
    camera.position.set(0, 0, 14)

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    // Lighting
    const ambient = new THREE.AmbientLight(isDark ? 0x94a3b8 : 0xffffff, isDark ? 0.9 : 1.1)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xcc785c, isDark ? 1.8 : 1.4)
    dirLight.position.set(6, 8, 10)
    scene.add(dirLight)
    const rimLight = new THREE.PointLight(0x5db8a6, isDark ? 2.2 : 1.6, 35)
    rimLight.position.set(-7, -5, 6)
    scene.add(rimLight)

    // Floating 3D geometric group
    const group = new THREE.Group()
    scene.add(group)

    const primaryColor = 0xcc785c
    const tealColor = 0x5db8a6
    const slateColor = isDark ? 0x475569 : 0xcbd5e1

    const shapes: Array<{ mesh: THREE.Object3D; speedX: number; speedY: number; floatOffset: number; baseY: number }> = []

    const icoGeo = new THREE.IcosahedronGeometry(2.1, 0)
    const icoMat = new THREE.MeshPhysicalMaterial({
      color: primaryColor,
      roughness: 0.25,
      metalness: 0.15,
      transparent: true,
      opacity: isDark ? 0.22 : 0.16,
      wireframe: true,
    })
    const icoMesh = new THREE.Mesh(icoGeo, icoMat)
    icoMesh.position.set(4.8, 1.8, -2)
    group.add(icoMesh)
    shapes.push({ mesh: icoMesh, speedX: 0.0022, speedY: 0.0031, floatOffset: 0, baseY: 1.8 })

    const torusGeo = new THREE.TorusKnotGeometry(1.4, 0.38, 64, 10)
    const torusMat = new THREE.MeshStandardMaterial({
      color: tealColor,
      roughness: 0.35,
      metalness: 0.3,
      transparent: true,
      opacity: isDark ? 0.2 : 0.14,
      wireframe: true,
    })
    const torusMesh = new THREE.Mesh(torusGeo, torusMat)
    torusMesh.position.set(-5.2, -1.6, -3)
    group.add(torusMesh)
    shapes.push({ mesh: torusMesh, speedX: -0.0018, speedY: 0.0025, floatOffset: 1.8, baseY: -1.6 })

    const octGeo = new THREE.OctahedronGeometry(1.15, 0)
    const octMat = new THREE.MeshStandardMaterial({
      color: slateColor,
      roughness: 0.4,
      metalness: 0.2,
      transparent: true,
      opacity: isDark ? 0.26 : 0.2,
      wireframe: true,
    })
    const octMesh = new THREE.Mesh(octGeo, octMat)
    octMesh.position.set(-1.2, 3.6, -5)
    group.add(octMesh)
    shapes.push({ mesh: octMesh, speedX: 0.0028, speedY: -0.002, floatOffset: 3.1, baseY: 3.6 })

    // Particle field
    const particleCount = window.innerWidth < 768 ? 90 : 180
    const positions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 28
      positions[i * 3 + 1] = (Math.random() - 0.5) * 18
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2
    }
    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particleMat = new THREE.PointsMaterial({
      color: isDark ? 0xe2e8f0 : 0x8b6f5c,
      size: 0.075,
      transparent: true,
      opacity: isDark ? 0.42 : 0.3,
    })
    const particles = new THREE.Points(particleGeo, particleMat)
    scene.add(particles)

    // Pointer parallax
    const targetRot = { x: 0, y: 0 }
    function handlePointerMove(e: PointerEvent) {
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1
      targetRot.y = nx * 0.12
      targetRot.x = -ny * 0.08
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    function handleResize() {
      if (!container || !renderer) return
      const w = container.clientWidth
      const h = Math.max(1, container.clientHeight)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    let rafId = 0
    const clock = new THREE.Clock()

    function renderFrame() {
      const t = clock.getElapsedTime()
      if (!reducedMotion) {
        for (const item of shapes) {
          item.mesh.rotation.x += item.speedX
          item.mesh.rotation.y += item.speedY
          item.mesh.position.y = item.baseY + Math.sin(t * 0.7 + item.floatOffset) * 0.35
        }
        particles.rotation.y = t * 0.015
        group.rotation.x += (targetRot.x - group.rotation.x) * 0.04
        group.rotation.y += (targetRot.y - group.rotation.y) * 0.04
      }
      renderer?.render(scene, camera)
      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(renderFrame)
      }
    }
    renderFrame()

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('resize', handleResize)
      icoGeo.dispose()
      icoMat.dispose()
      torusGeo.dispose()
      torusMat.dispose()
      octGeo.dispose()
      octMat.dispose()
      particleGeo.dispose()
      particleMat.dispose()
      if (renderer) {
        renderer.dispose()
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement)
        }
      }
    }
  }, [theme])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    />
  )
}
