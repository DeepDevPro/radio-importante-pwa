// services/catalogService.js - Serviço para gerenciar o catálogo
const { s3, bucketConfig } = require('../config/aws');
const path = require('path');

class CatalogService {
  
  // Buscar catálogo atual do S3
  async getCurrentCatalog() {
    try {
      const params = {
        Bucket: bucketConfig.bucketName,
        Key: bucketConfig.catalogPath
      };
      
      const data = await s3.getObject(params).promise();
      return JSON.parse(data.Body.toString());
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        // Se não existe catálogo, criar um vazio
        console.log('Catálogo não encontrado, criando novo...');
        return { tracks: [] };
      }
      throw error;
    }
  }
  
  // Salvar catálogo atualizado no S3
  async saveCatalog(catalog) {
    const params = {
      Bucket: bucketConfig.bucketName,
      Key: bucketConfig.catalogPath,
      Body: JSON.stringify(catalog, null, 2),
      ContentType: 'application/json',
      CacheControl: 'no-cache'
    };
    
    await s3.putObject(params).promise();
    console.log('Catálogo atualizado com sucesso');
  }
  
  // Adicionar nova faixa ao catálogo
  async addTrack(fileInfo) {
    const catalog = await this.getCurrentCatalog();
    
    // Extrair informações do arquivo
    const fileName = path.basename(fileInfo.key);
    const audioUrl = fileInfo.location;
    
    // Tentar extrair artista e título do nome do arquivo
    const nameWithoutExt = path.parse(fileName).name;
    const parts = nameWithoutExt.split('-').map(part => part.trim());
    
    let artist = 'Artista Desconhecido';
    let title = nameWithoutExt;
    
    if (parts.length >= 2) {
      artist = parts[0];
      title = parts.slice(1).join(' - ');
    }
    
    const newTrack = {
      id: Date.now().toString(),
      title: title,
      artist: artist,
      url: audioUrl,
      fileName: fileName,
      addedAt: new Date().toISOString(),
      duration: null, // Será preenchido posteriormente se necessário
      size: fileInfo.size || null
    };
    
    catalog.tracks.push(newTrack);
    
    // Ordenar por data de adição (mais recentes primeiro)
    catalog.tracks.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    
    await this.saveCatalog(catalog);
    
    return newTrack;
  }
  
  // Remover faixa do catálogo
  async removeTrack(trackId) {
    const catalog = await this.getCurrentCatalog();
    const trackIndex = catalog.tracks.findIndex(track => track.id === trackId);
    
    if (trackIndex === -1) {
      throw new Error('Faixa não encontrada no catálogo');
    }
    
    const removedTrack = catalog.tracks.splice(trackIndex, 1)[0];
    await this.saveCatalog(catalog);
    
    return removedTrack;
  }
  
  // Buscar estatísticas do catálogo
  async getStats() {
    const catalog = await this.getCurrentCatalog();
    
    const totalTracks = catalog.tracks.length;
    const artists = [...new Set(catalog.tracks.map(track => track.artist))];
    const totalArtists = artists.length;
    
    // Calcular tamanho total se disponível
    let totalSize = 0;
    catalog.tracks.forEach(track => {
      if (track.size) {
        totalSize += track.size;
      }
    });
    
    return {
      totalTracks,
      totalArtists,
      artists,
      totalSize: totalSize > 0 ? totalSize : null,
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = new CatalogService();
