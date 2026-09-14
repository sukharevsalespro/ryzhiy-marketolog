"""Проверка защищённой границы nginx→YC без сети и отправки сообщений."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parent/'lead'))
import index

KEY='test-only-'+'a'*64
class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{'INGRESS_SECRET':KEY});self.env.start();self.addCleanup(self.env.stop)
        self.event={'httpMethod':'POST','headers':{'Content-Type':'application/x-www-form-urlencoded','X-Ryzhiy-Gateway-Key':KEY},'body':'name=Иван&contact=%40ivan&consent=true'}
    def test_valid_gateway_preserves_delivery(self):
        with patch.object(index,'_send_telegram',return_value=True) as tg,patch.object(index,'_send_max',return_value=True) as mx:
            self.assertEqual(index.handler(self.event,None)['statusCode'],200);tg.assert_called_once();mx.assert_called_once()
    def test_missing_wrong_and_raw_spoofed_headers_do_not_send(self):
        for value in [None,'wrong','юникод']:
            headers={} if value is None else {'X-Ryzhiy-Gateway-Key':value}
            event={**self.event,'headers':headers,'requestContext':{'identity':{'sourceIp':'192.0.2.123'}}}
            with self.subTest(value=value),patch.object(index,'_send_telegram') as tg,patch.object(index,'_send_max') as mx:
                self.assertEqual(index.handler(event,None)['statusCode'],403);tg.assert_not_called();mx.assert_not_called()
    def test_missing_environment_fails_closed(self):
        with patch.dict(os.environ,{'INGRESS_SECRET':''}):self.assertFalse(index._gateway_authorized(self.event))
    def test_header_case_normalization_and_ambiguous_duplicates(self):
        self.assertTrue(index._gateway_authorized({'headers':{'x-ryzhiy-gateway-key':KEY}}))
        self.assertFalse(index._gateway_authorized({'headers':{'x-ryzhiy-gateway-key':KEY,'X-Ryzhiy-Gateway-Key':'wrong'}}))
    def test_invalid_event_and_header_shapes_fail_closed(self):
        for event in [None,'raw',{'headers':[]},{'headers':{'X-Ryzhiy-Gateway-Key':None}}]:self.assertFalse(index._gateway_authorized(event))
if __name__=='__main__':unittest.main()
