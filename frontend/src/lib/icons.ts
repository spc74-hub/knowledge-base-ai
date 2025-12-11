/**
 * Centralized icon configuration for the application.
 * Use these icons across all components that need icon selection.
 */

// Categorized icons - used for icon pickers with category tabs
export const ICON_CATEGORIES: Record<string, string[]> = {
    'Personal': ['👨‍👩‍👧‍👦', '❤️', '🏠', '🧘', '💪', '🏃', '🧠', '😊', '🛏️', '🍽️'],
    'Trabajo': ['💼', '📋', '💻', '📊', '📈', '🎯', '⚙️', '🔧', '📁', '✅'],
    'Finanzas': ['💰', '💵', '💳', '🏦', '📉', '💹', '🪙', '💎', '🧾', '📑'],
    'Educacion': ['📚', '🎓', '✏️', '📖', '🔬', '🧪', '🔭', '🗺️', '📝', '🎒'],
    'Creatividad': ['🎨', '🎵', '🎸', '📷', '🎬', '✍️', '🖌️', '🎭', '🎹', '📺'],
    'Social': ['🤝', '👥', '💬', '🎉', '🥳', '🎁', '📧', '☎️', '🌐', '🤗'],
    'Viajes': ['✈️', '🚗', '🏖️', '🏔️', '🗽', '🏕️', '🧳', '🚀', '🌍', '⛵'],
    'Naturaleza': ['🌱', '🌿', '🌳', '🌻', '🐕', '🐱', '🦋', '🌊', '☀️', '🌙'],
    'Tech': ['💻', '📱', '🤖', '🎮', '🖥️', '⌨️', '🔌', '📡', '💾', '🔐'],
    'Otros': ['⭐', '🔥', '⚡', '💡', '🎲', '🏆', '🎪', '🔮', '🧩', '🎈'],
};

// Category names for iteration
export const ICON_CATEGORY_NAMES = Object.keys(ICON_CATEGORIES);

// Flat list of all icons (useful for simple icon pickers)
export const ALL_ICONS: string[] = Object.values(ICON_CATEGORIES).flat();

// Default icons for quick selection (most commonly used)
export const DEFAULT_ICONS: string[] = [
    '✅', '💪', '📚', '🧘', '💧', '🏃', '🥗', '😴',
    '📝', '🎯', '💰', '🎵', '🌱', '🧠', '⏰', '🙏',
    '❤️', '🏠', '💼', '⭐', '🔥', '💡', '🎨', '🤝'
];

// Default icon to use when none is selected
export const DEFAULT_ICON = '📌';

// Helper function to get icons by category
export function getIconsByCategory(category: string): string[] {
    return ICON_CATEGORIES[category] || [];
}

// Helper function to find which category an icon belongs to
export function findIconCategory(icon: string): string | null {
    for (const [category, icons] of Object.entries(ICON_CATEGORIES)) {
        if (icons.includes(icon)) {
            return category;
        }
    }
    return null;
}

// Helper function to check if an icon exists in our collection
export function isValidIcon(icon: string): boolean {
    return ALL_ICONS.includes(icon);
}
