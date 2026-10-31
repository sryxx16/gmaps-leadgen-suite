import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWebsiteUrl,
  evaluateLeadQualification,
  groupDeleteRecommendations,
} from './leadQualification.js';

test('classifyWebsiteUrl separates owned domains from bio-links, marketplaces, free builders, and aggregators', () => {
  assert.equal(classifyWebsiteUrl(''), 'NONE');
  assert.equal(classifyWebsiteUrl('https://linktr.ee/kopisenja'), 'SOCIAL');
  assert.equal(classifyWebsiteUrl('https://shopee.co.id/tokomawar'), 'MARKETPLACE');
  assert.equal(classifyWebsiteUrl('https://tokomawar.blogspot.com'), 'FREE_BUILDER');
  assert.equal(classifyWebsiteUrl('https://katalogku.my.canva.site'), 'FREE_BUILDER');
  assert.equal(classifyWebsiteUrl('https://www.traveloka.com/id-id/hotel/detail'), 'AGGREGATOR');
  assert.equal(classifyWebsiteUrl('https://kopisenja.co.id'), 'OWNED_DOMAIN');
});

test('evaluateLeadQualification marks owned websites, closed businesses, franchises, and contact-less leads for deletion', () => {
  const hasWeb = evaluateLeadQualification({
    name: 'Klinik Gigi Sehat',
    website: 'https://klinikgigisehat.com',
    phone: '08123456789',
  });
  assert.equal(hasWeb.recommendDelete, true);
  assert.equal(hasWeb.reasonCode, 'HAS_OWNED_WEBSITE');

  const closedShop = evaluateLeadQualification({
    name: 'Warung Bakso Pak Kumis (Tutup Permanen)',
    phone: '08123456789',
  });
  assert.equal(closedShop.recommendDelete, true);
  assert.equal(closedShop.reasonCode, 'CLOSED_BUSINESS');

  const franchise = evaluateLeadQualification({
    name: 'Indomaret Raya Pajajaran',
    phone: '0811123456',
  });
  assert.equal(franchise.recommendDelete, true);
  assert.equal(franchise.reasonCode, 'FRANCHISE_OR_INSTITUTION');

  const deadContact = evaluateLeadQualification({
    name: 'Bengkel Las Jaya Mandiri',
    address: 'Jl. Merdeka 10',
    phone: '',
    whatsapp: '',
    socialMedia: '',
    onlineShop: '',
  });
  assert.equal(deadContact.recommendDelete, true);
  assert.equal(deadContact.reasonCode, 'NO_CONTACT_CHANNEL');

  const aiCold = evaluateLeadQualification({
    name: 'Kantor Cabang Korporat',
    phone: '0215551234',
    aiResearch: { leadQualification: 'COLD LEAD', leadScore: 22 },
  });
  assert.equal(aiCold.recommendDelete, true);
  assert.equal(aiCold.reasonCode, 'AI_DISQUALIFIED_COLD');
});

test('evaluateLeadQualification keeps free-builder and social-only active UMKM leads as PRIME prospects', () => {
  const canvaLead = evaluateLeadQualification({
    name: 'Catering Dapur Ibu Rina',
    categoryName: 'Jasa Katering',
    website: 'https://dapuriburina.my.canva.site',
    phone: '081388889999',
    rating: '4.8',
    reviewCount: '64',
  });
  assert.equal(canvaLead.recommendDelete, false);
  assert.equal(canvaLead.tier, 'PRIME');

  const grouped = groupDeleteRecommendations([
    { id: 1, name: 'Catering Dapur Ibu Rina', phone: '081388889999' },
    { id: 2, name: 'Alfamart Sudirman', phone: '08110000' },
    { id: 3, name: 'Studio Foto Cahaya', website: 'https://studiofotocahaya.id', phone: '08120000' },
  ]);
  assert.equal(grouped.totalFlagged, 2);
  assert.equal(grouped.groups.length, 2);
});

