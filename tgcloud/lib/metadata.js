/**
 * @file Metadata Extraction Layer
 * @description Extracts and bounds technical metadata from Telegram media structures.
 * Integrates science detection (PDB structures, chemical molecules, FASTA sequences, PMIDs).
 */

export function extractMediaMetadata(parsedMedia) {
  if (!parsedMedia) return { mediaMetadataJson: null, scienceBadge: null };

  const meta = {};
  let scienceBadge = null;

  // Audio specific
  if (parsedMedia.rawMedia?.performer || parsedMedia.rawMedia?.title) {
    meta.performer = parsedMedia.rawMedia.performer || null;
    meta.title = parsedMedia.rawMedia.title || null;
  }

  // Visual dimensions
  if (parsedMedia.width && parsedMedia.height) {
    meta.resolution = `${parsedMedia.width}x${parsedMedia.height}`;
    meta.aspectRatio = (parsedMedia.width / parsedMedia.height).toFixed(2);
  }

  // Duration
  if (parsedMedia.durationSeconds) {
    meta.durationSeconds = parsedMedia.durationSeconds;
    meta.durationFormatted = `${Math.floor(parsedMedia.durationSeconds / 60)}:${String(parsedMedia.durationSeconds % 60).padStart(2, '0')}`;
  }

  // Science detection based on filename and extension
  const fileName = (parsedMedia.fileName || '').trim();
  const fileExtension = (parsedMedia.fileExtension || '').toLowerCase();

  // 1. Macromolecular structure (PDB / CIF)
  if (fileExtension === 'pdb' || fileExtension === 'cif' || /\.pdb$/i.test(fileName) || /\.cif$/i.test(fileName)) {
    const pdbMatch = fileName.match(/([0-9][a-zA-Z0-9]{3})(?:[_\.\-\s]|$)/i);
    const predictedPdbId = pdbMatch ? pdbMatch[1].toUpperCase() : 'UNKNOWN';
    meta.scienceType = 'MACROMOLECULAR_STRUCTURE';
    meta.scienceFormat = fileExtension.toUpperCase();
    meta.predictedPdbId = predictedPdbId;
    meta.rcsbPdbUrl = `https://www.rcsb.org/structure/${predictedPdbId}`;
    meta.alphaFoldDbUrl = `https://alphafold.ebi.ac.uk/entry/${predictedPdbId}`;
    scienceBadge = `🧬 ساختار زیستی (PDB: ${predictedPdbId})`;
  }
  // 2. Genomic / Protein sequence (FASTA)
  else if (fileExtension === 'fasta' || fileExtension === 'fa' || /\.fasta$/i.test(fileName) || /\.fa$/i.test(fileName)) {
    meta.scienceType = 'GENOMIC_OR_PROTEIN_SEQUENCE';
    meta.scienceFormat = 'FASTA';
    scienceBadge = `🧬 توالی ژنومیک/پروتئین (FASTA)`;
  }
  // 3. Chemical compound (SDF / MOL / SMI)
  else if (fileExtension === 'sdf' || fileExtension === 'mol' || /\.sdf$/i.test(fileName) || /\.mol$/i.test(fileName)) {
    meta.scienceType = 'CHEMICAL_COMPOUND';
    meta.scienceFormat = fileExtension.toUpperCase() || 'SDF';
    scienceBadge = `🧪 ساختار مولکولی شیمیایی (${meta.scienceFormat})`;
  }
  // 4. Biomedical Literature reference (PMID)
  else {
    const pmidMatch = fileName.match(/pmid[_\-\s:]*([0-9]{5,10})/i) || fileName.match(/\b([0-9]{7,9})\b/);
    if (pmidMatch) {
      const pmid = pmidMatch[1];
      meta.scienceType = 'BIOMEDICAL_LITERATURE';
      meta.pmid = pmid;
      meta.pubmedUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
      scienceBadge = `📚 مقاله زیست‌پزشکی (PMID: ${pmid})`;
    }
  }

  const hasContent = Object.keys(meta).length > 0;
  return {
    mediaMetadataJson: hasContent ? JSON.stringify(meta) : null,
    scienceBadge,
  };
}

export function extractTelegramMetadata(message) {
  if (!message) return null;
  const raw = {
    message_id: message.message_id,
    date: message.date,
    forward_from: message.forward_from ? { id: message.forward_from.id, username: message.forward_from.username } : null,
    forward_from_chat: message.forward_from_chat ? { id: message.forward_from_chat.id, title: message.forward_from_chat.title } : null,
  };
  return JSON.stringify(raw);
}
