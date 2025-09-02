// routes/catalog.js - Rotas para gerenciar o catálogo
const express = require('express');
const router = express.Router();
const catalogService = require('../services/catalogService');

// GET /api/catalog - Obter catálogo completo
router.get('/', async (req, res) => {
  try {
    const catalog = await catalogService.getCurrentCatalog();
    
    res.json({
      success: true,
      catalog: catalog,
      meta: {
        totalTracks: catalog.tracks.length,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro ao buscar catálogo:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar catálogo.',
      code: 'CATALOG_FETCH_ERROR'
    });
  }
});

// GET /api/catalog/stats - Estatísticas do catálogo
router.get('/stats', async (req, res) => {
  try {
    const stats = await catalogService.getStats();
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas.',
      code: 'STATS_ERROR'
    });
  }
});

// DELETE /api/catalog/track/:id - Remover faixa do catálogo
router.delete('/track/:id', async (req, res) => {
  try {
    const trackId = req.params.id;
    
    if (!trackId) {
      return res.status(400).json({
        success: false,
        error: 'ID da faixa é obrigatório.',
        code: 'MISSING_TRACK_ID'
      });
    }
    
    const removedTrack = await catalogService.removeTrack(trackId);
    
    res.json({
      success: true,
      message: 'Faixa removida do catálogo com sucesso.',
      removedTrack: removedTrack
    });
    
  } catch (error) {
    console.error('Erro ao remover faixa:', error);
    
    if (error.message.includes('não encontrada')) {
      return res.status(404).json({
        success: false,
        error: error.message,
        code: 'TRACK_NOT_FOUND'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro ao remover faixa.',
      code: 'TRACK_REMOVE_ERROR'
    });
  }
});

// GET /api/catalog/search - Buscar faixas
router.get('/search', async (req, res) => {
  try {
    const { q, artist, limit = 50 } = req.query;
    
    if (!q && !artist) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro de busca é obrigatório (q ou artist).',
        code: 'MISSING_SEARCH_PARAMS'
      });
    }
    
    const catalog = await catalogService.getCurrentCatalog();
    let results = catalog.tracks;
    
    // Filtrar por termo de busca
    if (q) {
      const searchTerm = q.toLowerCase();
      results = results.filter(track =>
        track.title.toLowerCase().includes(searchTerm) ||
        track.artist.toLowerCase().includes(searchTerm) ||
        track.fileName.toLowerCase().includes(searchTerm)
      );
    }
    
    // Filtrar por artista
    if (artist) {
      const artistTerm = artist.toLowerCase();
      results = results.filter(track =>
        track.artist.toLowerCase().includes(artistTerm)
      );
    }
    
    // Limitar resultados
    const limitNum = parseInt(limit);
    if (limitNum > 0) {
      results = results.slice(0, limitNum);
    }
    
    res.json({
      success: true,
      results: results,
      meta: {
        total: results.length,
        query: { q, artist },
        limit: limitNum
      }
    });
    
  } catch (error) {
    console.error('Erro na busca:', error);
    res.status(500).json({
      success: false,
      error: 'Erro na busca.',
      code: 'SEARCH_ERROR'
    });
  }
});

module.exports = router;
