// GodRaysPass.js - Versión final autocontenida sin dependencias obsoletas
class GodRaysPass extends THREE.Pass {
    constructor(camera, mesh) {
        super();

        this.camera = camera;
        this.mesh = mesh;

        this.godraysMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                fX: { value: 0.5 },
                fY: { value: 0.5 },
                fExposure: { value: 0.6 },
                fDecay: { value: 0.95 },
                fDensity: { value: 0.7 },
                fWeight: { value: 0.4 },
                fClamp: { value: 1.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform sampler2D tDiffuse;
                uniform float fX;
                uniform float fY;
                uniform float fExposure;
                uniform float fDecay;
                uniform float fDensity;
                uniform float fWeight;
                uniform float fClamp;

                const int iSamples = 20;

                void main() {
                    vec2 deltaTextCoord = vec2(vUv - vec2(fX, fY));
                    deltaTextCoord *= 1.0 / float(iSamples) * fDensity;
                    float illuminationDecay = 1.0;
                    vec4 c = vec4(0.0);

                    for(int i=0; i < iSamples; i++) {
                        vUv -= deltaTextCoord;
                        vec4 sample = texture2D(tDiffuse, vUv);
                        sample *= illuminationDecay * fWeight;
                        c += sample;
                        illuminationDecay *= fDecay;
                    }
                    c *= fExposure;
                    c = clamp(c, 0.0, fClamp);
                    gl_FragColor = c;
                }
            `
        });

        // Geometría interna para renderizar a pantalla completa
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
        this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
        this.quad = new THREE.Mesh(this.geometry, this.godraysMaterial);

        this.renderToScreen = false;
    }

    render(renderer, writeBuffer, readBuffer) {
        const ndcPosition = new THREE.Vector3().copy(this.mesh.position);
        this.camera.updateMatrixWorld();
        ndcPosition.project(this.camera);

        this.godraysMaterial.uniforms.fX.value = ndcPosition.x * 0.5 + 0.5;
        this.godraysMaterial.uniforms.fY.value = ndcPosition.y * 0.5 + 0.5;
        this.godraysMaterial.uniforms.tDiffuse.value = readBuffer.texture;

        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
            renderer.render(this.quad, new THREE.Camera());
        } else {
            renderer.setRenderTarget(writeBuffer);
            if (this.clear) renderer.clear();
            renderer.render(this.quad, new THREE.Camera());
        }
    }
}

// Para mantener la compatibilidad con el espacio de nombres de THREE
THREE.GodRaysPass = GodRaysPass;
