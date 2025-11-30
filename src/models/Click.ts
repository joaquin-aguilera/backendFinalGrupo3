import mongoose, { Schema, Document } from 'mongoose';

// Modelo para clicks: registro de clics en productos
export interface IClick extends Document {
  id_producto: string;
  nombre: string;
  fecha: Date;
  userId?: string; // Opcional: para usuarios autenticados
}

const ClickSchema: Schema = new Schema({
  id_producto: { type: String, required: true },
  nombre: { type: String, required: true },
  fecha: { type: Date, required: true, default: Date.now },
  userId: { type: String }, // Opcional
});

// Índices para análisis de popularidad y clicks por usuario
ClickSchema.index({ id_producto: 1, fecha: -1 });
ClickSchema.index({ fecha: -1 });
ClickSchema.index({ userId: 1, fecha: -1 });

export default mongoose.model<IClick>('Click', ClickSchema, 'clicks');
