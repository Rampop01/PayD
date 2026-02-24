import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000/api';

export interface SEP31Transaction {
  id: string;
  status: string;
  amount_in: string;
  amount_out: string;
  asset_in: string;
  asset_out: string;
}

export const anchorService = {
  getAnchorInfo: async (domain: string) => {
    const response = await axios.get<{ info: Record<string, unknown> }>(
      `${API_BASE_URL}/payments/anchor-info`,
      {
        params: { domain },
      }
    );
    return response.data;
  },

  initiatePayment: async (
    domain: string,
    secretKey: string,
    paymentData: { amount: string; asset_code: string; receiver_id: string }
  ) => {
    const response = await axios.post<{ id: string }>(`${API_BASE_URL}/payments/sep31/initiate`, {
      domain,
      secretKey,
      paymentData,
    });
    return response.data;
  },

  getTransactionStatus: async (domain: string, id: string, secretKey: string) => {
    const response = await axios.get<SEP31Transaction>(
      `${API_BASE_URL}/payments/sep31/status/${domain}/${id}`,
      {
        params: { secretKey },
      }
    );
    return response.data;
  },
};
