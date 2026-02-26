import React, {
    useRef,
    useEffect,
    useCallback,
    useState,
    useImperativeHandle,
    forwardRef,
} from 'react';
import { DRAWING_DEFAULTS } from '@pulsing-supernova/shared';
import type { IDrawStroke, DrawTool } from '@pulsing-supernova/shared';

interface DrawingCanvasProps {
    isDrawer: boolean;
    onStroke?: (stroke: IDrawStroke) => void;
    onClear?: () => void;
    onUndo?: () => void;
}

export interface DrawingCanvasHandle {
    drawStroke: (stroke: IDrawStroke) => void;
    clearCanvas: () => void;
    undoStroke: () => void;
    replayStrokes: (strokes: IDrawStroke[]) => void;
}

/**
 * DrawingCanvas — HTML5 Canvas component for freehand drawing.
 * Supports pen/eraser tools, color/size selection, and undo.
 * Emits serialized strokes and can replay incoming strokes.
 */
export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
    ({ isDrawer, onStroke, onClear, onUndo }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const containerRef = useRef<HTMLDivElement>(null);
        const isDrawingRef = useRef(false);
        const currentPointsRef = useRef<[number, number][]>([]);
        const strokeHistoryRef = useRef<IDrawStroke[]>([]);

        // Drawing state
        const [color, setColor] = useState(DRAWING_DEFAULTS.PEN_COLOR);
        const [brushSize, setBrushSize] = useState(DRAWING_DEFAULTS.PEN_WIDTH);
        const [tool, setTool] = useState<DrawTool>('pen');

        // Get canvas context
        const getCtx = useCallback(() => {
            const canvas = canvasRef.current;
            if (!canvas) return null;
            return canvas.getContext('2d');
        }, []);

        // Convert mouse/touch coords to normalized 0-1
        const normalizeCoords = useCallback(
            (clientX: number, clientY: number): [number, number] => {
                const canvas = canvasRef.current;
                if (!canvas) return [0, 0];
                const rect = canvas.getBoundingClientRect();
                return [
                    (clientX - rect.left) / rect.width,
                    (clientY - rect.top) / rect.height,
                ];
            },
            []
        );

        // Convert normalized coords to canvas pixels
        const toCanvasCoords = useCallback(
            (nx: number, ny: number): [number, number] => {
                const canvas = canvasRef.current;
                if (!canvas) return [0, 0];
                return [nx * canvas.width, ny * canvas.height];
            },
            []
        );

        // Draw a single stroke on the canvas
        const renderStroke = useCallback(
            (stroke: IDrawStroke) => {
                const ctx = getCtx();
                if (!ctx || stroke.points.length < 2) return;

                const canvas = canvasRef.current!;

                ctx.beginPath();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                if (stroke.tool === 'eraser') {
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.lineWidth = stroke.width * (canvas.width / 800);
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.strokeStyle = stroke.color;
                    ctx.lineWidth = stroke.width * (canvas.width / 800);
                }

                const [startX, startY] = toCanvasCoords(
                    stroke.points[0][0],
                    stroke.points[0][1]
                );
                ctx.moveTo(startX, startY);

                for (let i = 1; i < stroke.points.length; i++) {
                    const [x, y] = toCanvasCoords(
                        stroke.points[i][0],
                        stroke.points[i][1]
                    );
                    ctx.lineTo(x, y);
                }

                ctx.stroke();
                ctx.globalCompositeOperation = 'source-over';
            },
            [getCtx, toCanvasCoords]
        );

        // Clear the canvas
        const clearCanvas = useCallback(() => {
            const ctx = getCtx();
            const canvas = canvasRef.current;
            if (!ctx || !canvas) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            strokeHistoryRef.current = [];
        }, [getCtx]);

        // Undo last stroke
        const undoStroke = useCallback(() => {
            const ctx = getCtx();
            const canvas = canvasRef.current;
            if (!ctx || !canvas) return;

            strokeHistoryRef.current.pop();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            strokeHistoryRef.current.forEach(renderStroke);
        }, [getCtx, renderStroke]);

        // Replay multiple strokes (for late joiners)
        const replayStrokes = useCallback(
            (strokes: IDrawStroke[]) => {
                strokeHistoryRef.current = [...strokes];
                strokes.forEach(renderStroke);
            },
            [renderStroke]
        );

        // Expose methods to parent
        useImperativeHandle(ref, () => ({
            drawStroke: (stroke: IDrawStroke) => {
                renderStroke(stroke);
                strokeHistoryRef.current.push(stroke);
            },
            clearCanvas,
            undoStroke,
            replayStrokes,
        }));

        // Handle canvas sizing
        useEffect(() => {
            const resize = () => {
                const canvas = canvasRef.current;
                const container = containerRef.current;
                if (!canvas || !container) return;

                const dpr = window.devicePixelRatio || 1;
                const rect = container.getBoundingClientRect();

                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;

                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.scale(dpr, dpr);
                    // Redraw strokes after resize
                    strokeHistoryRef.current.forEach(renderStroke);
                }
            };

            resize();
            window.addEventListener('resize', resize);
            return () => window.removeEventListener('resize', resize);
        }, [renderStroke]);

        // ─── Drawing event handlers ─────────────────────────

        const startDrawing = useCallback(
            (clientX: number, clientY: number) => {
                if (!isDrawer) return;
                isDrawingRef.current = true;
                currentPointsRef.current = [normalizeCoords(clientX, clientY)];
            },
            [isDrawer, normalizeCoords]
        );

        const continueDrawing = useCallback(
            (clientX: number, clientY: number) => {
                if (!isDrawingRef.current || !isDrawer) return;
                const point = normalizeCoords(clientX, clientY);
                currentPointsRef.current.push(point);

                // Live preview — draw segment
                const ctx = getCtx();
                if (!ctx) return;
                const canvas = canvasRef.current!;
                const points = currentPointsRef.current;

                if (points.length < 2) return;

                const prev = points[points.length - 2];
                const curr = points[points.length - 1];

                ctx.beginPath();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                if (tool === 'eraser') {
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.lineWidth = DRAWING_DEFAULTS.ERASER_WIDTH * (canvas.width / (800 * (window.devicePixelRatio || 1)));
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.strokeStyle = color;
                    ctx.lineWidth = brushSize * (canvas.width / (800 * (window.devicePixelRatio || 1)));
                }

                const [x1, y1] = toCanvasCoords(prev[0], prev[1]);
                const [x2, y2] = toCanvasCoords(curr[0], curr[1]);
                ctx.moveTo(x1 / (window.devicePixelRatio || 1), y1 / (window.devicePixelRatio || 1));
                ctx.lineTo(x2 / (window.devicePixelRatio || 1), y2 / (window.devicePixelRatio || 1));
                ctx.stroke();
                ctx.globalCompositeOperation = 'source-over';
            },
            [isDrawer, normalizeCoords, getCtx, toCanvasCoords, color, brushSize, tool]
        );

        const endDrawing = useCallback(() => {
            if (!isDrawingRef.current) return;
            isDrawingRef.current = false;

            const points = currentPointsRef.current;
            if (points.length < 2) return;

            const stroke: IDrawStroke = {
                points: [...points],
                color,
                width: tool === 'eraser' ? DRAWING_DEFAULTS.ERASER_WIDTH : brushSize,
                tool,
            };

            strokeHistoryRef.current.push(stroke);
            onStroke?.(stroke);
            currentPointsRef.current = [];
        }, [color, brushSize, tool, onStroke]);

        // Mouse events
        const handleMouseDown = useCallback(
            (e: React.MouseEvent) => startDrawing(e.clientX, e.clientY),
            [startDrawing]
        );
        const handleMouseMove = useCallback(
            (e: React.MouseEvent) => continueDrawing(e.clientX, e.clientY),
            [continueDrawing]
        );
        const handleMouseUp = useCallback(() => endDrawing(), [endDrawing]);

        // Touch events
        const handleTouchStart = useCallback(
            (e: React.TouchEvent) => {
                e.preventDefault();
                const touch = e.touches[0];
                startDrawing(touch.clientX, touch.clientY);
            },
            [startDrawing]
        );
        const handleTouchMove = useCallback(
            (e: React.TouchEvent) => {
                e.preventDefault();
                const touch = e.touches[0];
                continueDrawing(touch.clientX, touch.clientY);
            },
            [continueDrawing]
        );
        const handleTouchEnd = useCallback(
            (e: React.TouchEvent) => {
                e.preventDefault();
                endDrawing();
            },
            [endDrawing]
        );

        const handleClear = () => {
            clearCanvas();
            onClear?.();
        };

        const handleUndo = () => {
            undoStroke();
            onUndo?.();
        };

        return (
            <div className="game-canvas-area">
                {/* Drawing toolbar — only for drawer */}
                {isDrawer && (
                    <div className="drawing-toolbar animate-fade-in">
                        {/* Colors */}
                        {DRAWING_DEFAULTS.COLORS.map((c) => (
                            <div
                                key={c}
                                className={`color-swatch ${color === c && tool === 'pen' ? 'active' : ''}`}
                                style={{ background: c }}
                                onClick={() => {
                                    setColor(c);
                                    setTool('pen');
                                }}
                            />
                        ))}

                        <div className="toolbar-divider" />

                        {/* Brush sizes */}
                        {DRAWING_DEFAULTS.BRUSH_SIZES.map((size) => (
                            <div
                                key={size}
                                className={`brush-size-btn ${brushSize === size && tool === 'pen' ? 'active' : ''}`}
                                onClick={() => {
                                    setBrushSize(size);
                                    setTool('pen');
                                }}
                            >
                                <div
                                    className="brush-size-dot"
                                    style={{ width: size + 2, height: size + 2 }}
                                />
                            </div>
                        ))}

                        <div className="toolbar-divider" />

                        {/* Tools */}
                        <button
                            className={`btn-icon ${tool === 'eraser' ? 'active' : ''}`}
                            onClick={() => setTool('eraser')}
                            title="Eraser"
                        >
                            🧹
                        </button>
                        <button className="btn-icon" onClick={handleUndo} title="Undo">
                            ↩️
                        </button>
                        <button className="btn-icon" onClick={handleClear} title="Clear">
                            🗑️
                        </button>
                    </div>
                )}

                {/* Canvas */}
                <div
                    ref={containerRef}
                    className={`canvas-container ${!isDrawer ? 'readonly' : ''}`}
                >
                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    />
                </div>
            </div>
        );
    }
);

DrawingCanvas.displayName = 'DrawingCanvas';
