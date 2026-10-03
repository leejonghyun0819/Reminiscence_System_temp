// frontend/features/MouseDragHorizontalScroll.tsx
import React, { useRef, useEffect } from 'react';
import { ScrollView, Platform } from 'react-native';

export const MouseDragHorizontalScroll: React.FC<{
    children: React.ReactNode;
    contentContainerStyle?: any;
    style?: any;
}> = ({ children, contentContainerStyle, style }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const isDown = useRef(false);
    const startX = useRef(0);
    const scrollLeftVal = useRef(0);
    const hasMoved = useRef(false);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const el = scrollRef.current;
        if (!el) return;

        el.style.overscrollBehaviorX = 'none';
        el.style.overscrollBehavior = 'none';

        const handleWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (Platform.OS !== 'web') return;
        const el = scrollRef.current;
        if (!el) return;
        isDown.current = true;
        hasMoved.current = false;
        startX.current = e.pageX - el.offsetLeft;
        scrollLeftVal.current = el.scrollLeft;
        el.style.cursor = 'grabbing';
        el.style.userSelect = 'none';
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDown.current) return;
        const el = scrollRef.current;
        if (!el) return;
        const x = e.pageX - el.offsetLeft;
        const walk = (x - startX.current) * 1.5;
        if (Math.abs(walk) > 5) hasMoved.current = true;
        el.scrollLeft = scrollLeftVal.current - walk;
    };

    const handleMouseUpOrLeave = () => {
        isDown.current = false;
        const el = scrollRef.current;
        if (el) {
            el.style.cursor = 'grab';
            el.style.removeProperty('user-select');
        }
    };

    if (Platform.OS === 'web') {
        return (
            <div
                ref={scrollRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                style={{
                    display: 'flex',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    cursor: 'grab',
                    overscrollBehaviorX: 'none',
                    overscrollBehavior: 'none',
                    WebkitOverflowScrolling: 'touch',
                    width: '100%',
                    ...style,
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'row', gap: 10, ...contentContainerStyle }}>
                    {children}
                </div>
            </div>
        );
    }

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={contentContainerStyle}
            style={style}
        >
            {children}
        </ScrollView>
    );
};
