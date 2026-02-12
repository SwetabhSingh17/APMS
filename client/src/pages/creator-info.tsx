
import { Button } from "@/components/ui/button";
import { ArrowLeft, Linkedin, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";

export default function CreatorInfoPage() {
    const [_, setLocation] = useLocation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isHoveringWatermark, setIsHoveringWatermark] = useState(false);
    const watermarkRef = useRef<HTMLDivElement>(null);

    // Smoke & Mouse Trail System
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let bgParticles: Particle[] = [];
        let trailParticles: TrailParticle[] = [];
        let animationFrameId: number;

        // We need to track exact mouse history for interpolation
        let mouse = { x: -1000, y: -1000, lastX: -1000, lastY: -1000 };

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener("resize", resize);
        resize();

        const handleMouseMove = (e: MouseEvent) => {
            const currentX = e.clientX;
            const currentY = e.clientY;

            // Watermark Proximity Logic
            if (watermarkRef.current) {
                const rect = watermarkRef.current.getBoundingClientRect();
                const relX = currentX - rect.left;
                const relY = currentY - rect.top;

                watermarkRef.current.style.setProperty('--mouse-x', `${relX}px`);
                watermarkRef.current.style.setProperty('--mouse-y', `${relY}px`);
            }

            // If this is the first move, just set position
            if (mouse.lastX === -1000) {
                mouse.lastX = currentX;
                mouse.lastY = currentY;
                mouse.x = currentX;
                mouse.y = currentY;
                return;
            }

            mouse.lastX = mouse.x;
            mouse.lastY = mouse.y;
            mouse.x = currentX;
            mouse.y = currentY;

            // INTERPOLATION 
            const dx = mouse.x - mouse.lastX;
            const dy = mouse.y - mouse.lastY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Emit roughly every 4px
            const step = 4;
            const steps = Math.max(1, Math.floor(dist / step));

            for (let i = 0; i < steps; i++) {
                const t = i / steps;
                const x = mouse.lastX + dx * t;
                const y = mouse.lastY + dy * t;

                // JITTER: MASSIVE spread for WIDER smoke
                const spread = Math.min(60, 10 + dist * 0.4);
                const px = x + (Math.random() - 0.5) * spread;
                const py = y + (Math.random() - 0.5) * spread;

                // Drag + Random
                const vx = (Math.random() - 0.5) * 0.5;
                const vy = (Math.random() - 0.5) * 0.5;

                trailParticles.push(new TrailParticle(px, py, vx, vy));
            }
        };

        window.addEventListener("mousemove", handleMouseMove);

        // Background Particle Class
        class Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            size: number;
            alpha: number;
            baseAlpha: number;

            constructor() {
                this.x = Math.random() * canvas!.width;
                this.y = Math.random() * canvas!.height;
                this.vx = (Math.random() - 0.5) * 1.5;
                this.vy = (Math.random() - 0.5) * 1.5;
                this.size = Math.random() * 150 + 80;
                this.baseAlpha = Math.random() * 0.08 + 0.03;
                this.alpha = this.baseAlpha;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 300) {
                    const angle = Math.atan2(dy, dx);
                    const force = (300 - dist) / 300;
                    this.x -= Math.cos(angle) * force * 2;
                    this.y -= Math.sin(angle) * force * 2;
                }

                if (this.x < -200) this.x = canvas!.width + 200;
                if (this.x > canvas!.width + 200) this.x = -200;
                if (this.y < -200) this.y = canvas!.height + 200;
                if (this.y > canvas!.height + 200) this.y = -200;
            }

            draw() {
                if (!ctx) return;
                ctx.beginPath();
                const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
                gradient.addColorStop(0, `rgba(200, 230, 255, ${this.alpha})`);
                gradient.addColorStop(1, `rgba(200, 230, 255, 0)`);
                ctx.fillStyle = gradient;
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Trail Particle Class
        class TrailParticle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            size: number;
            life: number;
            maxLife: number;
            baseAlpha: number;

            constructor(x: number, y: number, vx: number, vy: number) {
                this.x = x;
                this.y = y;
                this.vx = vx;
                this.vy = vy;
                // RADIUS: Increased again by 50% (was ~60-100, now ~90-150 start)
                this.size = Math.random() * 60 + 90;
                this.life = 0;
                // FASTER FADE (+25%): Even shorter life
                this.maxLife = 15 + Math.random() * 10;
                // LESS GLOW (-50%): Very faint
                this.baseAlpha = 0.02 + Math.random() * 0.02;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.vx *= 0.96;
                this.vy *= 0.96;
                // Expand proportionally
                this.size += 2.5;
                this.life++;
            }

            draw() {
                if (!ctx) return;
                const progress = this.life / this.maxLife;

                // LINEAR FADE FIX
                // Simply fade out linearly over the entire life.
                // It guarantees 0 at the end.
                // We use pow(..., 0.5) to keep it visible longer then drop?
                // Or linear is safest.
                // Let's stick to simple linear to be 100% sure it's smooth.
                let alpha = this.baseAlpha * (1 - progress);

                if (alpha <= 0.0001) return;

                ctx.beginPath();
                // REVERT: Back to soft Blue-White
                const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
                gradient.addColorStop(0, `rgba(215, 245, 255, ${alpha})`);
                gradient.addColorStop(1, `rgba(215, 245, 255, 0)`);
                ctx.fillStyle = gradient;
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const initParticles = () => {
            bgParticles = [];
            const count = window.innerWidth < 768 ? 60 : 100;
            for (let i = 0; i < count; i++) {
                bgParticles.push(new Particle());
            }
        };
        initParticles();

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            bgParticles.forEach(p => { p.update(); p.draw(); });

            // LIMIT FIX: Increase buffer size significantly to prevent tail cutoff
            if (trailParticles.length > 2000) {
                trailParticles = trailParticles.slice(trailParticles.length - 1500);
            }

            trailParticles = trailParticles.filter(p => p.life < p.maxLife);
            trailParticles.forEach(p => { p.update(); p.draw(); });

            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener("resize", resize);
            window.removeEventListener("mousemove", handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);


    return (
        <div className="min-h-screen bg-black text-white overflow-hidden relative font-sans selection:bg-cyan-500 selection:text-black">

            {/* Smoke & Trail Canvas */}
            <canvas
                ref={canvasRef}
                className="fixed inset-0 w-full h-full pointer-events-none z-10 mix-blend-screen"
            />

            {/* Content Container */}
            <div className="relative z-20 w-full max-w-7xl mx-auto px-6 py-12 md:py-24 flex flex-col min-h-screen justify-between pointer-events-none">

                {/* Header */}
                <header className="flex justify-between items-center pointer-events-auto">
                    <Button
                        onClick={() => setLocation("/auth")}
                        variant="ghost"
                        className="text-white hover:bg-white/10 hover:text-white rounded-full px-6 border border-white/20 transition-all duration-300 backdrop-blur-md"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Reality
                    </Button>
                    <div className="text-xs uppercase tracking-[0.3em] text-white/50 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                        Integral Project Hub
                    </div>
                </header>

                {/* Main Content (Bio) */}
                <main className="flex-grow flex flex-col justify-center max-w-4xl mx-auto space-y-12 pointer-events-auto text-center md:text-left mt-12 md:mt-24">

                    {/* Central Block */}
                    <div className="prose prose-invert prose-lg md:prose-2xl max-w-none font-light text-gray-300 space-y-8 animate-in fade-in zoom-in-95 duration-1000 fill-mode-forwards">
                        <div className="bg-gradient-to-br from-white/15 to-white/5 p-6 md:p-12 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700"></div>

                            {/* Header Section: Image Left, Text Right */}
                            <div className="flex flex-col md:flex-row items-center gap-8 mb-8 border-b border-white/10 pb-8">
                                {/* Profile Picture */}
                                <div className="flex-shrink-0">
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-cyan-500 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                                        <img
                                            src="/profile.jpg"
                                            alt="Swetabh Singh"
                                            className="relative w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-2 border-white/20 shadow-2xl backdrop-blur-xl hover:scale-105 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                                    </div>
                                </div>

                                {/* Welcome Text */}
                                <h2 className="text-2xl md:text-3xl font-normal text-white m-0 text-center md:text-left leading-tight">
                                    Welcome to the only corner of the internet that revolves entirely around me, <strong className="text-cyan-300">Swetabh Singh</strong>.
                                </h2>
                            </div>

                            <p className="leading-relaxed">
                                I am a Developer and Designer by day and a connoisseur of <code className="bg-white/10 px-2 py-1 rounded text-cyan-300 font-mono text-base">Ctrl+C / Ctrl+V</code> by night. With over 3 years of experience pretending to listen during Zoom calls, I have mastered the fine art of turning caffeine into code and ambiguous client feedback into functional products.
                            </p>

                            <p className="leading-relaxed">
                                My LinkedIn says I’m a <span className="italic text-white">'strategic thinker'</span> and <span className="italic text-white">'passionate problem solver,'</span> which is corporate-speak for <span className="text-cyan-200">'I overthink everything'</span> and <span className="text-cyan-200">'I fix things I broke five minutes ago.'</span> I specialize in <span className="line-through decoration-red-500 decoration-2">Day Dreaming</span>, <span className="text-white font-medium">Creating solutions</span>, and nodding convincingly when someone mentions 'synergy.'
                            </p>

                            <p className="text-xl md:text-2xl font-light text-white/90 pt-4">
                                If you’re looking for someone to disrupt the industry or just fix that one bug annoying your users you’ve found your guy. Let’s build something great, <span className="text-gray-500">or at least something that doesn’t crash on Fridays.</span>
                            </p>
                        </div>
                    </div>
                </main>

                {/* Spacer for Watermark */}
                <div className="h-32"></div>

            </div>

            {/* Watermark: Glass Outline & Smoke Flashlight */}
            <div
                ref={watermarkRef}
                className="fixed bottom-10 left-10 z-30 pointer-events-auto select-none"
                onMouseEnter={() => setIsHoveringWatermark(true)}
                onMouseLeave={() => setIsHoveringWatermark(false)}
                style={{
                    // Use a radial gradient mask to create a "flashlight" reveal effect
                    // The mask is centered on the mouse position (relative to the container)
                    // It reveals the content only near the mouse, creating a spotlight effect
                    WebkitMaskImage: `radial-gradient(circle 250px at var(--mouse-x, -9999px) var(--mouse-y, -9999px), black 0%, transparent 100%)`,
                    maskImage: `radial-gradient(circle 250px at var(--mouse-x, -9999px) var(--mouse-y, -9999px), black 0%, transparent 100%)`,
                }}
            >
                <div className="relative">
                    {/* Layer 0: The "Frost" (Blurred Backing) */}
                    <h2
                        className="absolute inset-0 text-6xl md:text-9xl font-black font-rounded tracking-tighter whitespace-nowrap blur-sm"
                        style={{
                            color: 'rgba(255, 255, 255, 0.5)',
                            opacity: 0.3,
                        }}
                    >
                        SWETABH SINGH
                    </h2>

                    {/* Layer 1: The Glass Edge (Stroke) */}
                    <h2
                        className="absolute inset-0 text-6xl md:text-9xl font-black font-rounded tracking-tighter whitespace-nowrap"
                        style={{
                            color: 'transparent',
                            WebkitTextStroke: '1.5px rgba(255, 255, 255, 0.5)',
                            // Add a subtle drop shadow that is always present but revealed by mask
                            filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.1))',
                        }}
                    >
                        SWETABH SINGH
                    </h2>

                    {/* Layer 2: The Gradient Fill (Glass Body) */}
                    <h2
                        className="relative text-6xl md:text-9xl font-black font-rounded tracking-tighter whitespace-nowrap"
                        style={{
                            background: 'linear-gradient(to bottom, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 80%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            opacity: 0.4,
                        }}
                    >
                        SWETABH SINGH
                    </h2>

                    {/* Layer 3: The Reflection (Smoke Interaction) */}
                    <h2
                        className="absolute inset-0 text-6xl md:text-9xl font-black font-rounded tracking-tighter text-white mix-blend-overlay whitespace-nowrap pointer-events-none"
                        style={{
                            opacity: 0.5,
                        }}
                    >
                        SWETABH SINGH
                    </h2>
                </div>
            </div>

            {/* Sarcastic LinkedIn Footer */}
            <div className="fixed bottom-8 right-8 z-30 pointer-events-auto">
                <a
                    href="https://www.linkedin.com/in/swetabhsingh17"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 px-6 py-4 rounded-2xl flex items-center gap-4 transition-all duration-300 hover:scale-105 hover:border-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                >
                    <div className="bg-cyan-500/20 p-2 rounded-lg group-hover:bg-cyan-500/30 transition-colors">
                        <Linkedin className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-white/60 text-xs uppercase tracking-widest font-medium group-hover:text-white/80">Connect or Regret</span>
                        <span className="text-white font-light text-sm">Validate my impostor syndrome <ExternalLink className="inline h-3 w-3 ml-1 opacity-50" /></span>
                    </div>
                </a>
            </div>
        </div>
    );
}

