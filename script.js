// --- 1. REGISTRAR EL PLUGIN DE GSAP ---
gsap.registerPlugin(ScrollTrigger);

// --- 2. SETUP BÁSICO DE THREE.JS ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const canvas = document.getElementById('sculpture-canvas');
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas, 
    antialias: true, 
    alpha: true // ¡Importante! Fondo transparente
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

camera.position.z = 5;

// Luces (más dramáticas)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);
// Una luz de "relleno" desde la izquierda
const pointLight = new THREE.PointLight(0x00f2a0, 3, 10); // Color primario
pointLight.position.set(-3, 2, -2);
scene.add(pointLight);


// --- 3. EL OBJETO 3D (La "Escultura") ---
// Usemos algo más interesante que un cubo
// 
const geometry = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
const material = new THREE.MeshStandardMaterial({
    color: 0xe0e0e0,
    metalness: 0.7,
    roughness: 0.4
});
const sculpture = new THREE.Mesh(geometry, material);
sculpture.position.y = 0; // Centrado
scene.add(sculpture);

// --- 4. BUCLE DE RENDER ---
// Hacemos que la cámara siga al mouse sutilmente
const cursor = { x: 0, y: 0 };
window.addEventListener('mousemove', (event) => {
    cursor.x = (event.clientX / window.innerWidth) * 2 - 1;
    cursor.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

const clock = new THREE.Clock();
function animate() {
    const elapsedTime = clock.getElapsedTime();

    // Sutil efecto parallax del mouse sobre la CÁMARA
    const parallaxX = cursor.x * 0.3;
    const parallaxY = -cursor.y * 0.3;
    // Usamos GSAP para suavizar el movimiento (lerping)
    gsap.to(camera.position, {
        x: parallaxX,
        y: parallaxY,
        duration: 2,
        ease: 'power3.out'
    });

    // La rotación base la controla el scroll, pero podemos añadir
    // una rotación propia lenta
    sculpture.rotation.y += 0.001;
    
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();

// --- 5. MANEJO DE RESIZE ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});


// --- 6. ¡LA MAGIA DE GSAP! ---

// A. Animación de entrada (cuando carga la página)
// ---------------------------------------------
const introTl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1.5 } });

introTl
    .from(sculpture.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 2 })
    .to('.gsap-title', { opacity: 1, scale: 1, duration: 1 }, "-=1.5") // Al mismo tiempo
    .to('.gsap-subtitle', { opacity: 1, y: 0, duration: 1 }, "-=1")
    .from('.header', { y: -100, opacity: 0, duration: 1 }, "-=1");


// B. Animaciones de SCROLLTRIGGER
// ---------------------------------------------

// Creamos una TIMELINE MAESTRA que controlará TODO
const mainTl = gsap.timeline({
    // La vinculamos a ScrollTrigger
    scrollTrigger: {
        trigger: '#scroll-container', // El contenedor que se scrollea
        start: 'top top',     // Empieza cuando la parte superior del trigger llega a la parte superior del viewport
        end: 'bottom bottom', // Termina cuando el final del trigger llega al final del viewport
        scrub: 1,             // ¡LA CLAVE! Suaviza la animación con el scroll (1 segundo de "lag")
        // markers: true,     // Descomenta esto para depurar
    }
});

// AHORA, AÑADIMOS ANIMACIONES A ESTA TIMELINE MAESTRA
// Se ejecutarán en secuencia a medida que el usuario scrollea.

// 1. Transición de HOME a ABOUT
mainTl
    .addLabel('home-to-about')
    // Mueve la cámara y rota la escultura
    .to(sculpture.rotation, { x: 1, y: 1.5, z: 0.5 }, 'home-to-about')
    .to(camera.position, { z: 4, x: -1 }, 'home-to-about')
    .to(pointLight.position, { x: -3, y: 2, z: 4 }, 'home-to-about')
    // Oculta el texto de HOME
    .to(['.gsap-title', '.gsap-subtitle'], { opacity: 0, y: -50 }, 'home-to-about')
    // Muestra el texto de ABOUT
    .to('#about .gsap-reveal', { opacity: 1, y: 0, stagger: 0.2 }, 'home-to-about+=0.5'); // stagger!


// 2. Transición de ABOUT a PROJECTS
mainTl
    .addLabel('about-to-projects')
    // Mueve la cámara a la derecha
    .to(sculpture.rotation, { x: 0, y: -1.5, z: 0 }, 'about-to-projects')
    .to(camera.position, { z: 4.5, x: 1 }, 'about-to-projects')
    .to(pointLight.position, { x: 3, y: -2, z: 3 }, 'about-to-projects')
    // Oculta el texto de ABOUT
    .to('#about .gsap-reveal', { opacity: 0, y: -50, stagger: 0.1 }, 'about-to-projects')
    // Muestra el texto de PROJECTS
    .to('#projects .gsap-reveal', { opacity: 1, y: 0, stagger: 0.2 }, 'about-to-projects+=0.5');


// 3. Transición a CONTACT
mainTl
    .addLabel('projects-to-contact')
    // La cámara se acerca mucho
    .to(sculpture.rotation, { x: 2, y: 3, z: 1 }, 'projects-to-contact')
    .to(camera.position, { z: 2.5, x: 0 }, 'projects-to-contact')
    // Oculta el texto de PROJECTS
    .to('#projects .gsap-reveal', { opacity: 0, y: -50, stagger: 0.1 }, 'projects-to-contact')
    // Muestra el texto de CONTACT
    .to('#contact .gsap-reveal', { opacity: 1, y: 0 }, 'projects-to-contact+=0.5');

// C. Micro-interacciones con GSAP
// ---------------------------------------------
const navLinks = document.querySelectorAll('.navigation a');
navLinks.forEach(link => {
    // Usamos GSAP para un hover más sofisticado
    const hoverTl = gsap.timeline({ paused: true });
    hoverTl.to(link, { color: 'var(--color-primary)', x: 5, duration: 0.3, ease: 'power2.out' });

    link.addEventListener('mouseenter', () => hoverTl.play());
    link.addEventListener('mouseleave', () => hoverTl.reverse());
});