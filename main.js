'use-strict';

// --- IMPORTACIONES DE LIBRERÍAS (desde CDNs en HTML) ---
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const THREE = window.THREE;
const Lenis = window.Lenis;

gsap.registerPlugin(ScrollTrigger);

// --- CÓDIGO DE SHADERS (GLSL) ---

// --- SHADERS DE LA ESTRELLA DEL HÉROE ---
const starVertexShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying float vNoise;

  // Ruido Simplex 3D (para no repetirlo, asumimos que está disponible)
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vNormal = normal;
    float distortion = snoise(position * 3.0 + uTime * 0.5) * 0.2;
    vec3 newPosition = position + normal * distortion;
    vNoise = snoise(position * 1.0 + uTime * 0.2);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;
const starFragmentShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying float vNoise;

  void main() {
    float intensity = 1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0));
    vec3 baseColor = vec3(0.0, 1.0, 1.0); // Cian
    vec3 accentColor = vec3(1.0, 0.0, 0.75); // Magenta

    float rim = pow(intensity, 2.0);

    vec3 color = mix(baseColor, accentColor, vNoise);
    color += vec3(1.0, 1.0, 1.0) * rim * 0.5;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Shader para las Imágenes de Proyecto (Distorsión)
const projectVertexShader = `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.z += sin(pos.x * 10.0 + uTime) * uIntensity * 0.1;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
const projectFragmentShader = `
  uniform float uTime;
  uniform sampler2D uTexture;
  uniform float uIntensity;
  varying vec2 vUv;
  
  void main() {
    vec2 uv = vUv;
    // Efecto "ripple"
    uv.x += (sin(uv.y * 10.0 + uTime * 0.5) * 0.03) * uIntensity;
    uv.y += (cos(uv.x * 10.0 + uTime * 0.5) * 0.03) * uIntensity;
    
    vec4 color = texture2D(uTexture, uv);
    gl_FragColor = color;
  }
`;

/**
 * Clase para gestionar el fondo WebGL (Estrellas, Toroide)
 */
class WebGLScene {
    constructor() {
        this.scene = new THREE.Scene();
        this.container = document.querySelector('.webgl-canvas');
        this.sizes = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        this.initCamera();
        this.initRenderer();
        this.initLights(); // <- AÑADIDO
        this.initMesh();
        this.initSkybox(); // <- REEMPLAZA initParticles
        this.initDustClouds(); // <- AÑADIDO
        this.initResizeListener();
    }

    initLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Un poco más de luz ambiental
        this.scene.add(ambientLight);

        // Luz principal que emana de la estrella
        const starLight = new THREE.PointLight(0x00ffff, 1.5, 15);
        this.scene.add(starLight);

        // Luz que sigue a la cámara para iluminar el contenido
        this.cameraLight = new THREE.PointLight(0xffffff, 0.5, 10);
        this.scene.add(this.cameraLight);

        // Spotlight para enfocar el contenido
        this.spotlight = new THREE.SpotLight(0xffffff, 0.8, 20, Math.PI / 8, 0.5);
        this.spotlight.castShadow = true;
        this.scene.add(this.spotlight);
        this.scene.add(this.spotlight.target);
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(75, this.sizes.width / this.sizes.height, 0.1, 1000);
        this.camera.position.z = 2.5; 
        this.scene.add(this.camera);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.container,
            alpha: true, 
            antialias: true
        });
        this.renderer.setSize(this.sizes.width, this.sizes.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // --- POST-PROCESADO ---
        this.composer = new THREE.EffectComposer(this.renderer);
        this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));

        const bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(this.sizes.width, this.sizes.height),
            1.8, // strength (AUMENTADO PARA VERIFICACIÓN)
            0.2, // radius
            0.0  // threshold
        );
        this.composer.addPass(bloomPass);
    }

    initMesh() {
        // --- ESTRELLA CENTRAL ---
        this.uniforms = {
            uTime: { value: 0 },
            uMouse: { value: new THREE.Vector2(0, 0) },
        };

        const starGeometry = new THREE.IcosahedronGeometry(1, 30);
        const starMaterial = new THREE.ShaderMaterial({
            vertexShader: starVertexShader,
            fragmentShader: starFragmentShader,
            uniforms: this.uniforms,
        });
        
        this.star = new THREE.Mesh(starGeometry, starMaterial);
        this.scene.add(this.star);

        // --- CINTURÓN DE ASTEROIDES DIVERSIFICADO ---
        this.asteroids = new THREE.Group();
        const textureLoader = new THREE.TextureLoader();
        const asteroidTexture = textureLoader.load('https://threejs.org/examples/textures/planets/moon_1024.jpg');
        const normalMapTexture = textureLoader.load('https://threejs.org/examples/textures/planets/moon_normal_1024.jpg');
        const asteroidGeometries = [
            new THREE.DodecahedronGeometry(0.05, 0),
            new THREE.BoxGeometry(0.08, 0.08, 0.08),
            new THREE.IcosahedronGeometry(0.06, 0)
        ];

        for (let i = 0; i < 800; i++) {
            const geometry = asteroidGeometries[Math.floor(Math.random() * asteroidGeometries.length)];
            const material = new THREE.MeshStandardMaterial({
                map: asteroidTexture,
                normalMap: normalMapTexture,
                roughness: 0.9,
                metalness: 0.2,
            });
            const asteroid = new THREE.Mesh(geometry, material);

            const angle = Math.random() * Math.PI * 2;
            const radius = 2 + Math.random() * 4; // Un cinturón más ancho
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = (Math.random() - 0.5) * 0.5;

            asteroid.position.set(x, y, z);
            asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

            this.asteroids.add(asteroid);
        }
        this.scene.add(this.asteroids);
    }

    initSkybox() {
        const loader = new THREE.CubeTextureLoader();
        const texture = loader.load([
            'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_px.jpg',
            'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_nx.jpg',
            'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_py.jpg',
            'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_ny.jpg',
            'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_pz.jpg',
            'https://threejs.org/examples/textures/cube/MilkyWay/dark-s_nz.jpg'
        ]);
        this.scene.background = texture;
    }

    initDustClouds() {
        const dustGeometry = new THREE.BufferGeometry();
        const dustVertices = [];
        const dustTextureLoader = new THREE.TextureLoader();
        const dustTexture = dustTextureLoader.load('https://threejs.org/examples/textures/sprites/disc.png');

        for (let i = 0; i < 2000; i++) {
            const x = (Math.random() - 0.5) * 30;
            const y = (Math.random() - 0.5) * 30;
            const z = (Math.random() - 0.5) * 30;
            dustVertices.push(x, y, z);
        }

        dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustVertices, 3));

        const dustMaterial = new THREE.PointsMaterial({
            size: 0.1,
            map: dustTexture,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.dustClouds = new THREE.Points(dustGeometry, dustMaterial);
        this.scene.add(this.dustClouds);
    }

    initResizeListener() {
        window.addEventListener('resize', () => {
            this.sizes.width = window.innerWidth;
            this.sizes.height = window.innerHeight;
            this.camera.aspect = this.sizes.width / this.sizes.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.sizes.width, this.sizes.height);
            this.composer.setSize(this.sizes.width, this.sizes.height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        });
    }

    render(mouse, lenis) {
        this.uniforms.uTime.value += 0.01;
        
        // Rotación de la estrella y los asteroides
        this.star.rotation.y += 0.001;
        this.asteroids.rotation.y += 0.0003;

        const targetMouse = new THREE.Vector2(
            (mouse.getX() / this.sizes.width) * 2 - 1,
            -(mouse.getY() / this.sizes.height) * 2 + 1
        );
        this.uniforms.uMouse.value.lerp(targetMouse, 0.05);
        
        // La luz sigue a la cámara
        this.cameraLight.position.copy(this.camera.position);

        // Animación de las nubes de polvo
        if (this.dustClouds) {
            this.dustClouds.rotation.x += 0.0001;
            this.dustClouds.rotation.y += 0.0001;
        }

        this.composer.render();
    }
}

/**
 * Clase para los efectos 3D de las imágenes de proyecto
 */
class ProjectHoverFx {
    constructor() {
        this.container = document.querySelector('.project-hover-gallery');
        this.scenes = [];
        this.links = document.querySelectorAll('.project-item-link');
        this.mouse = new THREE.Vector2(0, 0);
        this.targetMouse = new THREE.Vector2(0, 0);
        
        this.initScenes();
        this.initEvents();
    }

    initScenes() {
        const canvases = document.querySelectorAll('.project-hover-canvas');
        canvases.forEach(canvas => {
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, 400 / 500, 0.1, 100);
            camera.position.z = 1;
            
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
            renderer.setSize(400, 500);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            
            const loader = new THREE.TextureLoader();
            const texture = loader.load(canvas.dataset.imageSrc);
            
            const uniforms = {
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector2(0, 0) },
                uTexture: { value: texture },
                uIntensity: { value: 0 }
            };
            
            const geometry = new THREE.PlaneGeometry(2, 2.5, 20, 20); // Geometría 4:5
            const material = new THREE.ShaderMaterial({
                vertexShader: projectVertexShader,
                fragmentShader: projectFragmentShader,
                uniforms,
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            
            this.scenes.push({ canvas, scene, camera, renderer, uniforms, mesh });
        });
    }

    initEvents() {
        const galleryXTo = gsap.quickTo(this.container, "x", { duration: 0.8, ease: "power3.out" });
        const galleryYTo = gsap.quickTo(this.container, "y", { duration: 0.8, ease: "power3.out" });
        
        window.addEventListener('mousemove', e => {
            galleryXTo(e.clientX);
            galleryYTo(e.clientY);
            
            this.targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });
        
        this.links.forEach(link => {
            const projectId = link.dataset.projectId;
            const targetScene = this.scenes.find(s => s.canvas.id === projectId);
            
            link.addEventListener('mouseenter', () => {
                gsap.to(this.container, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" });
                this.scenes.forEach(s => s.canvas.classList.remove('is-active'));
                targetScene.canvas.classList.add('is-active');
                gsap.to(targetScene.uniforms.uIntensity, { value: 1.0, duration: 0.5, ease: "power2.out" });
            });
            
            link.addEventListener('mouseleave', () => {
                gsap.to(this.container, { opacity: 0, scale: 0.8, duration: 0.3, ease: "power2.out" });
                gsap.to(targetScene.uniforms.uIntensity, { value: 0.0, duration: 0.5, ease: "power2.out" });
            });
        });
    }

    render() {
        this.mouse.lerp(this.targetMouse, 0.05);
        
        this.scenes.forEach(s => {
            if (s.canvas.classList.contains('is-active')) {
                s.uniforms.uTime.value += 0.01;
                s.uniforms.uMouse.value.copy(this.mouse);
                s.renderer.render(s.scene, s.camera);
            }
        });
    }
}

/**
 * ¡NUEVO! Clase para los pequeños lienzos 3D en las tarjetas de Tecnología
 */
class TechMesh {
    constructor(canvas, geometry, mouse) {
        this.canvas = canvas;
        this.geometry = geometry;
        this.mouse = mouse; // Referencia al mouse global
        this.card = canvas.closest('.tech-card'); // La tarjeta contenedora
        
        // Ajusta el tamaño al del canvas en CSS
        const rect = canvas.getBoundingClientRect();
        this.sizes = { width: rect.width || 352, height: rect.height || 200 }; 
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.sizes.width / this.sizes.height, 0.1, 100);
        this.camera.position.z = 2;
        
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
        this.renderer.setSize(this.sizes.width, this.sizes.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        this.initLights();
        this.initMesh();
        this.initMouseEvents();
    }
    
    initLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);
        const point = new THREE.PointLight(0x00ffff, 0.5); // Luz Cian
        point.position.set(2, 2, 2);
        this.scene.add(point);
    }
    
    initMesh() {
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ffff, // Color primario
            roughness: 0.4,
            metalness: 0.2,
            wireframe: true
        });
        this.mesh = new THREE.Mesh(this.geometry, material);
        this.scene.add(this.mesh);
    }
    
    initMouseEvents() {
        this.targetRotation = new THREE.Vector2(0, 0);
        this.card.addEventListener('mousemove', (e) => {
            const rect = this.card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Normaliza el ratón de -0.5 a 0.5
            const mouseX = (x / rect.width) - 0.5;
            const mouseY = (y / rect.height) - 0.5;
            
            // Invierte para una rotación natural
            this.targetRotation.x = -mouseY * 0.5;
            this.targetRotation.y = mouseX * 0.5;
        });
        
        this.card.addEventListener('mouseleave', () => {
            this.targetRotation.x = 0;
            this.targetRotation.y = 0;
        });
    }
    
    render() {
        // Interpola (lerp) la rotación para que sea suave
        this.mesh.rotation.x = gsap.utils.interpolate(this.mesh.rotation.x, this.targetRotation.x, 0.05);
        this.mesh.rotation.y = gsap.utils.interpolate(this.mesh.rotation.y, this.targetRotation.y, 0.05);
        this.mesh.rotation.z += 0.005; // Rotación constante lenta
        
        this.renderer.render(this.scene, this.camera);
    }
}


/**
 * Clase principal que orquesta toda la aplicación
 */
class App {
    constructor() {
        this.mouse = { x: 0, y: 0, getX: () => this.mouse.x, getY: () => this.mouse.y };
        window.addEventListener('mousemove', e => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        this.techMeshes = [];
        this.init();
    }

    init() {
        const preloaderTl = this.initPreloader();
        this.initPageTransitions(preloaderTl);
        this.lenis = this.initSmoothScroll();
        this.webgl = new WebGLScene();
        this.projectFx = new ProjectHoverFx();
        this.initTechCanvases(); // ¡NUEVO!
        this.initPageAnimations();
    }

    initPreloader() {
        const preloader = document.querySelector('.preloader');
        const preloaderNumber = document.getElementById('preloader-number');
        const preloaderSpans = document.querySelectorAll('.preloader-counter span');
        const counter = { val: 0 };
        
        const preloaderTl = gsap.timeline();
        preloaderTl
            .to(counter, {
                val: 100,
                duration: 3.0,
                ease: "power3.inOut",
                onUpdate: () => {
                    preloaderNumber.textContent = Math.round(counter.val);
                }
            })
            .to(preloaderSpans, { y: "-100%", stagger: 0.05, duration: 0.8, ease: "power3.in" })
            .to(preloader, { yPercent: -100, duration: 1.2, ease: "expo.inOut" }, "-=0.6");
        
        return preloaderTl;
    }

    initPageTransitions(preloaderTl) {
        const nav = document.querySelector('nav');
        const heroTitle = document.querySelector('.hero-title');
        
        const masterTl = gsap.timeline();
        masterTl
            .call(() => {
                document.body.classList.remove('is-loading');
            })
            .to(nav, {
                y: 0,
                opacity: 1,
                duration: 1.2,
                ease: "expo.out"
            })
            // *** ¡LA CORRECCIÓN DEL BUG DEL TÍTULO! ***
            .from(heroTitle, {
                opacity: 0,
                y: 50,
                duration: 1.0,
                ease: "expo.out",
                immediateRender: false 
            }, "-=0.8");
            
        preloaderTl.add(masterTl);
    }

    initSmoothScroll() {
        const lenis = new Lenis();
        
        // **LA CORRECCIÓN DEL BUG DE SCROLL**
        lenis.on('scroll', ScrollTrigger.update);
        
        ScrollTrigger.scrollerProxy(document.body, {
            scrollTop(value) {
                if (arguments.length) {
                    lenis.scrollTo(value, { immediate: true });
                }
                return lenis.scroll;
            },
            getBoundingClientRect() {
                return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
            },
            pinType: "fixed" 
        });
        
        // **EL BUCLE DE RENDER UNIFICADO (ARREGLO BUG #3)**
        gsap.ticker.add((time) => {
            lenis.raf(time * 1000); // 1. Actualiza Lenis
            
            // 2. Renderiza las escenas 3D (solo si existen)
            if (this.webgl) this.webgl.render(this.mouse, this.lenis); 
            if (this.projectFx) this.projectFx.render();
            if (this.techMeshes) this.techMeshes.forEach(mesh => mesh.render()); // ¡NUEVO!
        });
        
        gsap.ticker.lagSmoothing(0);
        
        // **LA OTRA CORRECCIÓN DE BUG DE SCROLL**
        ScrollTrigger.addEventListener("refresh", () => lenis.resize());
        
        return lenis; 
    }

    initPageAnimations() {
        this.initCustomCursor();
        this.initMagneticButtons();
        this.initHeroPhysics();
        this.initThemeSwitcher(); // Eliminado, pero lo dejo por si quieres reactivarlo
        this.initScrollAnimations();
    }
    
    // ¡NUEVO! Inicializa los lienzos 3D de las tarjetas de tecnología
    initTechCanvases() {
        const geometries = [
            new THREE.BoxGeometry(1.2, 1.2, 1.2),
            new THREE.IcosahedronGeometry(1),
            new THREE.DodecahedronGeometry(1),
            new THREE.TorusKnotGeometry(0.8, 0.2, 100, 16)
        ];
        
        document.querySelectorAll('.tech-canvas').forEach((canvas, index) => {
            const geo = geometries[index % geometries.length]; // Elige una geometría
            this.techMeshes.push(new TechMesh(canvas, geo, this.mouse));
        });
    }

    // --- Módulos de Animación ---

    initCustomCursor() {
        const cursorDot = document.querySelector('.cursor-dot');
        const cursorFollower = document.querySelector('.cursor-follower');
        const hoverEls = document.querySelectorAll('a, button, .project-item-link, .tech-card, .contact-link');
        
        const dotXTo = gsap.quickTo(cursorDot, "x", { duration: 0.1, ease: "power2.out" });
        const dotYTo = gsap.quickTo(cursorDot, "y", { duration: 0.1, ease: "power2.out" });
        const followerXTo = gsap.quickTo(cursorFollower, "x", { duration: 0.6, ease: "elastic.out(1, 0.5)" });
        const followerYTo = gsap.quickTo(cursorFollower, "y", { duration: 0.6, ease: "elastic.out(1, 0.5)" });
        
        window.addEventListener('mousemove', e => {
            dotXTo(e.clientX);
            dotYTo(e.clientY);
            followerXTo(e.clientX);
            followerYTo(e.clientY);
        });
        
        hoverEls.forEach(el => {
            el.addEventListener('mouseenter', () => {
                if (el.classList.contains('project-item-link')) document.body.classList.add('cursor-hover-project');
                else if (el.classList.contains('contact-link')) document.body.classList.add('cursor-hover-huge');
                else document.body.classList.add('cursor-hover-link');
            });
            el.addEventListener('mouseleave', () => {
                document.body.classList.remove('cursor-hover-project', 'cursor-hover-huge', 'cursor-hover-link');
            });
        });
    }

    initMagneticButtons() {
        const buttons = document.querySelectorAll('.magnetic-button');
        buttons.forEach(btn => {
            const child = btn.querySelector('a') || btn.querySelector('button');
            if (!child) return;
            
            let strength = 0.4;
            if (btn.classList.contains('contact-link-wrapper')) strength = 0.8;

            const btnXTo = gsap.quickTo(btn, "x", { duration: 0.8, ease: "elastic.out(1, 0.4)" });
            const btnYTo = gsap.quickTo(btn, "y", { duration: 0.8, ease: "elastic.out(1, 0.4)" });
            const childXTo = gsap.quickTo(child, "x", { duration: 0.8, ease: "elastic.out(1, 0.4)" });
            const childYTo = gsap.quickTo(child, "y", { duration: 0.8, ease: "elastic.out(1, 0.4)" });
            
            btn.addEventListener('mousemove', e => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                
                btnXTo(x * strength); btnYTo(y * strength);
                childXTo(x * (strength * 0.4)); childYTo(y * (strength * 0.4));
            });
            
            btn.addEventListener('mouseleave', () => {
                btnXTo(0); btnYTo(0); childXTo(0); childYTo(0);
            });
        });
    }

    initHeroPhysics() {
        const chars = this.splitTextByChar('.hero-title[data-split-text]');
        if (!chars) return;
        
        chars.forEach(char => {
            const xTo = gsap.quickTo(char, "x", { duration: 1.2, ease: "elastic.out(1, 0.4)" });
            const yTo = gsap.quickTo(char, "y", { duration: 1.2, ease: "elastic.out(1, 0.4)" });

            gsap.ticker.add(() => {
                const rect = char.getBoundingClientRect();
                const charX = rect.left + rect.width / 2;
                const charY = rect.top + rect.height / 2;
                
                const dx = charX - this.mouse.getX();
                const dy = charY - this.mouse.getY();
                const distance = Math.sqrt(dx * dx + dy * dy);
                const repelStrength = 150;
                
                if (distance < repelStrength) {
                    const force = (repelStrength - distance) / repelStrength;
                    const moveX = (dx / distance) * force * 40;
                    const moveY = (dy / distance) * force * 40;
                    xTo(moveX); yTo(moveY);
                } else {
                    xTo(0); yTo(0);
                }
            });
        });
    }

    initThemeSwitcher() {
        // La lógica del tema ha sido eliminada
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.style.display = 'none'; // Oculta el botón
        }
    }

    initScrollAnimations() {
        // --- NUEVO SISTEMA DE ANIMACIÓN POR SECCIÓN ---

        // Animación inicial del Héroe
        gsap.to('.hero-title', {
            scrollTrigger: {
                trigger: '#hero',
                start: 'top top',
                end: 'bottom top',
                scrub: true,
            },
            opacity: 0,
            y: -100
        });

        const sections = document.querySelectorAll('main > section');
        const cameraPositions = [
            { x: 0, y: 0, z: 4 },   // About
            { x: 3, y: -2, z: 6 },  // Skills Ticker (la cámara se mueve)
            { x: -4, y: 1, z: 9 },  // Technologies
            { x: 5, y: -1, z: 12 }, // Projects
            { x: 0, y: 2, z: 15 },  // Experience
            { x: 0, y: 0, z: 18 }   // Contact
        ];

        sections.forEach((section, i) => {
            const contentPanel = section.querySelector('.content-panel');

            // Animación para mover la cámara a la posición de la sección
            gsap.to(this.webgl.camera.position, {
                x: cameraPositions[i].x,
                y: cameraPositions[i].y,
                z: cameraPositions[i].z,
                scrollTrigger: {
                    trigger: section,
                    start: 'top bottom',
                    end: 'center center',
                    scrub: 1.5,
                }
            });

            // Animación para hacer aparecer el panel de contenido
            if (contentPanel) {
                gsap.fromTo(contentPanel,
                    { opacity: 0, y: 50, visibility: 'hidden' },
                    {
                        opacity: 1,
                        y: 0,
                        visibility: 'visible',
                        scrollTrigger: {
                            trigger: section,
                            start: 'top 20%',
                            end: 'center center',
                            toggleActions: 'play none none reverse'
                        }
                    }
                );
            }
        });


        // --- Resto de Animaciones de Scroll ---
        
        gsap.to(".ticker-track", { xPercent: -50, ease: "none", duration: 40, repeat: -1 });

        this.splitTextByWord('.about-text', 'word');
        gsap.to(".about-text .word", {
            opacity: 1,
            stagger: 0.1,
            ease: "power2.out",
            scrollTrigger: {
                trigger: "#about",
                start: "top 60%",
                end: "bottom 70%",
                scrub: 1.5,
            }
        });

        const techSection = document.getElementById('technologies');
        const techContainer = document.querySelector('.tech-container');
        
        gsap.to(techContainer, {
            x: () => -(techContainer.scrollWidth - document.documentElement.clientWidth + 100),
            ease: "none",
            scrollTrigger: {
                trigger: techSection,
                start: "top top",
                end: () => "+=" + (techContainer.scrollWidth - document.documentElement.clientWidth),
                scrub: 1,
                pin: true,
                invalidateOnRefresh: true,
            }
        });
        
        const skewTarget = { value: 0 };
        const skewClamp = gsap.utils.clamp(-10, 10); 
        gsap.ticker.add(() => {
            const velocity = this.lenis.velocity;
            const skewed = skewClamp(velocity * 0.1);
            skewTarget.value = gsap.utils.interpolate(skewTarget.value, skewed, 0.1); 
            gsap.set(techContainer, { skewX: skewTarget.value, force3D: true });
        });
        
        const timeline = document.querySelector('.exp-timeline');
        gsap.to(".timeline-line", {
            height: "100%",
            scrollTrigger: {
                trigger: timeline,
                start: "top 70%",
                end: "bottom 70%",
                scrub: 1
            }
        });

        gsap.utils.toArray('.exp-item').forEach(item => {
            const date = item.querySelector('.exp-date');
            const details = item.querySelector('.exp-details');
            
            gsap.from(date, { x: -100, opacity: 0, duration: 1, ease: "power3.out",
                scrollTrigger: { trigger: item, start: "top 85%", toggleActions: "play none none none" }
            });
            gsap.from(details, { x: 100, opacity: 0, duration: 1, ease: "power3.out",
                scrollTrigger: { trigger: item, start: "top 85%", toggleActions: "play none none none" }
            });
        });

        // ¡NUEVO! Animación de Títulos por Caracteres
         gsap.utils.toArray('.section-title[data-animate-title]').forEach(title => {
            const chars = this.splitTextByChar(title);
            gsap.from(chars, {
                yPercent: 100,
                opacity: 0,
                stagger: 0.03,
                duration: 0.8,
                ease: "power3.out",
                scrollTrigger: {
                    trigger: title,
                    start: "top 85%",
                    toggleActions: "play none none none"
                }
            });
        });
    }

    // --- (Helpers) ---
    splitTextByChar(selector) {
        // Permite pasar un nodo o un string
        const elem = (typeof selector === 'string') ? document.querySelector(selector) : selector;
        if (!elem) return null;
        const text = elem.innerText.trim();
        elem.innerHTML = '';
        return text.split('').map(char => {
            const span = document.createElement('span');
            span.classList.add('char');
            span.innerText = char === ' ' ? '\u00A0' : char;
            elem.appendChild(span);
            return span;
        });
    }

    splitTextByWord(selector, className) {
        const elems = document.querySelectorAll(selector);
        elems.forEach(elem => {
            const text = elem.innerText.trim();
            elem.innerHTML = '';
            text.split(' ').forEach(word => {
                const span = document.createElement('span');
                span.classList.add(className);
                span.innerHTML = `${word}&nbsp;`;
                elem.appendChild(span);
            });
        });
    }
}

// Inicia la aplicación cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
    new App();
});