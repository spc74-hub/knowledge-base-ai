/**
 * Content type definitions.
 */

export type ContentType = 'web' | 'youtube' | 'tiktok' | 'twitter';

export type SchemaType =
    | 'Article'
    | 'NewsArticle'
    | 'BlogPosting'
    | 'TechArticle'
    | 'VideoObject'
    | 'AudioObject'
    | 'SocialMediaPosting'
    | 'HowTo'
    | 'Review';

export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed';

export type TechnicalLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type ContentFormat = 'tutorial' | 'news' | 'opinion' | 'analysis' | 'review' | 'guide' | 'reference';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface EntityPerson {
    name: string;
    role?: string;
    organization?: string;
}

export interface EntityOrganization {
    name: string;
    type?: string;
}

export interface EntityPlace {
    name: string;
    type?: string;
    country?: string;
}

export interface EntityProduct {
    name: string;
    type?: string;
    company?: string;
}

export interface Entities {
    persons: EntityPerson[];
    organizations: EntityOrganization[];
    places: EntityPlace[];
    products: EntityProduct[];
}

export interface Content {
    id: string;
    url: string;
    type: ContentType;
    title: string;
    summary?: string;
    schema_type?: SchemaType;
    schema_subtype?: string;
    iab_tier1?: string;
    iab_tier2?: string;
    iab_tier3?: string;
    concepts: string[];
    user_tags: string[];
    is_favorite: boolean;
    is_archived: boolean;
    processing_status: ProcessingStatus;
    created_at: string;
    updated_at?: string;
}

export interface ContentDetail extends Content {
    raw_content?: string;
    entities?: Entities;
    language?: string;
    sentiment?: Sentiment;
    technical_level?: TechnicalLevel;
    content_format?: ContentFormat;
    reading_time_minutes?: number;
    metadata?: Record<string, unknown>;
}

export interface ContentCreateInput {
    url: string;
    tags?: string[];
    process_async?: boolean;
}

export interface ContentUpdateInput {
    title?: string;
    user_tags?: string[];
    is_favorite?: boolean;
    is_archived?: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}

export interface ContentFilters {
    type?: ContentType;
    category?: string;
    tags?: string[];
    favorite?: boolean;
    archived?: boolean;
    q?: string;
}

export interface ContentStats {
    total_contents: number;
    by_type: Record<ContentType, number>;
    by_category: Record<string, number>;
    favorites_count: number;
    archived_count: number;
    this_week: number;
    this_month: number;
}
