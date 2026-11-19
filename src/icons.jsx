import React from "react";
import { Egg, Truck, Package, Leaf, Tag, Sun, Hand, MessageCircle, ArrowUp, Menu, X, ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Check, Heart, Minus, Plus, Phone, Mail, MapPin, ExternalLink, AlertTriangle, ShoppingBag, Bird, Circle } from "lucide-react";

/* Real line icons (Lucide). Use <Ic n="egg" /> everywhere instead of emojis. */
export const base = (M) => function Icon({ n, s = 20, ...p }) { const C = M[n]; return C ? <C size={s} strokeWidth={1.8} aria-hidden="true" focusable="false" {...p} /> : null; };
export const COMMON = { egg: Egg, truck: Truck, box: Package, leaf: Leaf, tag: Tag, sun: Sun, hand: Hand, chat: MessageCircle, up: ArrowUp, menu: Menu, close: X, left: ChevronLeft, right: ChevronRight, arrow: ArrowRight, back: ArrowLeft,
  check: Check, heart: Heart, minus: Minus, plus: Plus, phone: Phone, mail: Mail, pin: MapPin, link: ExternalLink, alert: AlertTriangle, bag: ShoppingBag, hen: Bird, dot: Circle };
export const Ic = base(COMMON);
