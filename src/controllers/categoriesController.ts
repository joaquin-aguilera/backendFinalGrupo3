import { Request, Response } from 'express';
import { CategoriesService } from '../services/categoriesService';

/**
 * Obtener todas las categorías con sus imágenes
 */
export const getAllCategories = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const categories = await CategoriesService.getAllCategories();

    const endTime = Date.now();
    console.log(`Categorías obtenidas en ${endTime - startTime}ms`);

    res.json(categories);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener las categorías' });
  }
};

/**
 * Obtener productos más clickeados
 */
export const getTopClickedProducts = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const limit = parseInt(req.query.limit as string) || 6;

    // Validar límite
    if (limit < 1 || limit > 20) {
      return res.status(400).json({ error: 'El límite debe estar entre 1 y 20' });
    }

    const topProducts = await CategoriesService.getTopClickedProducts(limit);

    const endTime = Date.now();
    console.log(`Top productos obtenidos en ${endTime - startTime}ms`);

    res.json({
      limit,
      total: topProducts.length,
      productos: topProducts
    });
  } catch (error) {
    console.error('Error al obtener productos más clickeados:', error);
    res.status(500).json({ error: 'Error al obtener productos más clickeados' });
  }
};

/**
 * Obtener productos de una categoría específica
 */
export const getProductsByCategory = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { category } = req.params;

    if (!category) {
      return res.status(400).json({ error: 'La categoría es requerida' });
    }

    const productos = await CategoriesService.getProductsByCategory(decodeURIComponent(category));

    const endTime = Date.now();
    console.log(`Productos de categoría '${category}' obtenidos en ${endTime - startTime}ms`);

    res.json({
      categoria: category,
      total: productos.length,
      productos
    });
  } catch (error) {
    console.error('Error al obtener productos por categoría:', error);
    res.status(500).json({ error: 'Error al obtener productos de la categoría' });
  }
};
