'use client';

import { CardResult } from '../../../lib/types';
import { CARD_COLORS } from '../../../lib/constants';

interface CardItemProps {
  card: CardResult;
}

export function CardItem({ card }: CardItemProps) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 flex items-start gap-4">
        <span
          className={`shrink-0 mt-0.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
            CARD_COLORS[card.type] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'
          }`}
        >
          {card.type}
        </span>
        <span className="text-sm text-zinc-800 font-medium flex-1 leading-snug">
          {card.line}
        </span>
      </div>
    </div>
  );
}
