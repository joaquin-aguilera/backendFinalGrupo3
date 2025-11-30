import mongoose, { Schema, Document } from 'mongoose';

// Modelo para search_history: historial completo de búsquedas de usuarios autenticados
export interface ISearchHistory extends Document {
  userId: string;
  queryText: string;
  filters?: Record<string, any>;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  requestedAt: Date;
  results: string[]; // IDs de productos encontrados
}

const SearchHistorySchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  queryText: { type: String, required: true },
  filters: { type: Schema.Types.Mixed, default: {} },
  sortBy: { type: String },
  sortDir: { type: String, enum: ['asc', 'desc'] },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  requestedAt: { type: Date, required: true, default: Date.now },
  results: { type: [String], default: [] }, // IDs de productos (strings)
});

// Índices optimizados
SearchHistorySchema.index({ userId: 1, requestedAt: -1 });
SearchHistorySchema.index({ requestedAt: -1 });
SearchHistorySchema.index({ queryText: 'text' });

export const SearchHistory = mongoose.model<ISearchHistory>('SearchHistory', SearchHistorySchema, 'search_history');

// Modelo para search_queries: búsquedas simples para análisis (anónimas)
export interface ISearchQuery extends Document {
  valor_busqueda: string;
  fecha: Date;
}

const SearchQuerySchema: Schema = new Schema({
  valor_busqueda: { type: String, required: true },
  fecha: { type: Date, required: true, default: Date.now },
});

// Índices
SearchQuerySchema.index({ fecha: -1 });
SearchQuerySchema.index({ valor_busqueda: 'text' });

export const SearchQuery = mongoose.model<ISearchQuery>('SearchQuery', SearchQuerySchema, 'search_queries');

// Exportar por defecto SearchHistory para compatibilidad
export default SearchHistory;
export type ISearch = ISearchHistory;
