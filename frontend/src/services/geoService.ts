import api from './api';
import { GeographicAssignment } from '../types/wallet';

export interface District {
  id: number;
  name: string;
  code?: string;
  state: string;
  constituencies_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface Constituency {
  id: number;
  name: string;
  code?: string;
  district_id?: number;
  district_name: string;
  wards_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface Ward {
  id: number;
  ward_number: string;
  constituency_id?: number;
  constituency_name: string;
  area_name?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export const geoService = {
  // Master Districts
  async getDistricts(): Promise<District[]> {
    const res = await api.get('/api/admin/districts');
    return res.data;
  },

  async createDistrict(data: { name: string; code?: string; state?: string }): Promise<District> {
    const res = await api.post('/api/admin/districts', data);
    return res.data;
  },

  async updateDistrict(id: number, data: { name?: string; code?: string; state?: string }): Promise<District> {
    const res = await api.put(`/api/admin/districts/${id}`, data);
    return res.data;
  },

  async deleteDistrict(id: number): Promise<{ status: string; message: string }> {
    const res = await api.delete(`/api/admin/districts/${id}`);
    return res.data;
  },

  // Master Constituencies
  async getConstituencies(district_id?: number): Promise<Constituency[]> {
    const res = await api.get('/api/admin/constituencies', { params: { district_id } });
    return res.data;
  },

  async createConstituency(data: {
    name: string;
    code?: string;
    district_id?: number;
    district_name: string;
  }): Promise<Constituency> {
    const res = await api.post('/api/admin/constituencies', data);
    return res.data;
  },

  async updateConstituency(
    id: number,
    data: { name?: string; code?: string; district_id?: number; district_name?: string }
  ): Promise<Constituency> {
    const res = await api.put(`/api/admin/constituencies/${id}`, data);
    return res.data;
  },

  async deleteConstituency(id: number): Promise<{ status: string; message: string }> {
    const res = await api.delete(`/api/admin/constituencies/${id}`);
    return res.data;
  },

  // Master Wards
  async getWards(constituency_id?: number): Promise<Ward[]> {
    const res = await api.get('/api/admin/wards', { params: { constituency_id } });
    return res.data;
  },

  async createWard(data: {
    ward_number: string;
    constituency_id?: number;
    constituency_name: string;
    area_name?: string;
    description?: string;
  }): Promise<Ward> {
    const res = await api.post('/api/admin/wards', data);
    return res.data;
  },

  async updateWard(
    id: number,
    data: {
      ward_number?: string;
      constituency_id?: number;
      constituency_name?: string;
      area_name?: string;
      description?: string;
    }
  ): Promise<Ward> {
    const res = await api.put(`/api/admin/wards/${id}`, data);
    return res.data;
  },

  async deleteWard(id: number): Promise<{ status: string; message: string }> {
    const res = await api.delete(`/api/admin/wards/${id}`);
    return res.data;
  },

  // Locations filtered by scope
  async getLocations(): Promise<{ districts: string[]; constituencies: string[]; wards: string[] }> {
    const res = await api.get('/api/admin/locations');
    return res.data;
  },

  // User Geographic Assignments
  async getUserAssignments(params?: { user_id?: number; constituency?: string; status?: string }): Promise<GeographicAssignment[]> {
    const res = await api.get('/api/admin/user-assignments', { params });
    return res.data;
  },

  async createUserAssignment(data: {
    user_id: number;
    district: string;
    constituency: string;
    wards: string[];
    area?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  }): Promise<GeographicAssignment> {
    const res = await api.post('/api/admin/user-assignments', data);
    return res.data;
  },

  async updateUserAssignment(
    id: number,
    data: {
      district?: string;
      constituency?: string;
      wards?: string[];
      area?: string;
      start_date?: string;
      end_date?: string;
      status?: string;
    }
  ): Promise<GeographicAssignment> {
    const res = await api.put(`/api/admin/user-assignments/${id}`, data);
    return res.data;
  },

  async deleteUserAssignment(id: number): Promise<{ status: string; message: string }> {
    const res = await api.delete(`/api/admin/user-assignments/${id}`);
    return res.data;
  }
};
